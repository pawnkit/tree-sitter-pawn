#include <tree_sitter/parser.h>

#include <ctype.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

// The external scanner is intentionally narrow: it only classifies shared-if
// layouts that need cross-line lookahead after directive selection, plus the
// immediate `<` that opens callback signatures without stealing bare `i<10`
// relational expressions.
enum TokenType {
  CALLBACK_SIGNATURE_START,
  CONDITIONAL_IF_ELSE_PREAMBLE,
  CONDITIONAL_IF_ELSE_IF_PREAMBLE,
  CONDITIONAL_IF_BLOCK_PREAMBLE,
  CONDITIONAL_IF_ELSE_BLOCK_PREAMBLE,
  CONDITIONAL_IF_PREAMBLE,
  CONDITIONAL_IF_WRAPPED_ELSE_PREAMBLE,
  CONDITIONAL_IF_ELSE_CLOSING,
  CONDITIONAL_IF_CLOSING,
  UNSUPPORTED_DEFINE_HEADER,
  UNSUPPORTED_MACRO_PARAMETER_LIST,
  OPAQUE_DEFINE_VALUE,
};

typedef enum {
  DIRECTIVE_NONE,
  DIRECTIVE_IF,
  DIRECTIVE_ELSE,
  DIRECTIVE_ELSEIF,
  DIRECTIVE_ENDIF,
} DirectiveType;

typedef enum {
  IF_BRANCH_NONE,
  IF_BRANCH_HEADER,
  IF_BRANCH_HEADER_WITH_BRACE,
  IF_BRANCH_HEADER_WITH_ELSE_BLOCK,
  IF_BRANCH_HEADER_WITH_INLINE_ELSE,
  IF_BRANCH_INLINE_STATEMENT,
} IfBranchKind;

static bool scan_balanced_block_followed_by_else(TSLexer *lexer);
static bool scan_block_tail_after_open_brace(TSLexer *lexer, IfBranchKind *kind);
static bool scan_nested_shared_if_header(TSLexer *lexer, IfBranchKind *kind);
static bool scan_callback_signature_start(TSLexer *lexer);
static bool scan_line_comment_after_slash(TSLexer *lexer);
static bool scan_block_comment_after_slash(TSLexer *lexer);
static bool scan_unsupported_define_header(TSLexer *lexer);
static bool scan_unsupported_macro_parameter_list(TSLexer *lexer);
static bool scan_opaque_define_value(TSLexer *lexer);

static inline void advance(TSLexer *lexer) {
  lexer->advance(lexer, false);
}

static inline void skip(TSLexer *lexer) {
  lexer->advance(lexer, true);
}

static bool is_identifier_char(int32_t c) {
  return isalnum(c) || c == '_';
}

static void skip_spaces(TSLexer *lexer) {
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r' || lexer->lookahead == '\n') {
    skip(lexer);
  }
}

static bool scan_line_comment(TSLexer *lexer) {
  if (lexer->lookahead != '/') return false;
  advance(lexer);
  if (lexer->lookahead != '/') return false;
  advance(lexer);
  while (lexer->lookahead && lexer->lookahead != '\n') {
    skip(lexer);
  }
  return true;
}

static bool scan_block_comment(TSLexer *lexer) {
  if (lexer->lookahead != '/') return false;
  advance(lexer);
  if (lexer->lookahead != '*') return false;
  advance(lexer);
  while (lexer->lookahead) {
    if (lexer->lookahead == '*') {
      advance(lexer);
      if (lexer->lookahead == '/') {
        skip(lexer);
        return true;
      }
      continue;
    }
    skip(lexer);
  }
  return false;
}

static bool scan_line_comment_after_slash(TSLexer *lexer) {
  if (lexer->lookahead != '/') return false;
  advance(lexer);
  while (lexer->lookahead && lexer->lookahead != '\n') {
    skip(lexer);
  }
  return true;
}

static bool is_define_value_keyword(const char *buffer, size_t length) {
  static const char *keywords[] = {
    "const",
    "enum",
    "forward",
    "native",
    "new",
    "public",
    "static",
    "stock",
  };

  for (size_t i = 0; i < sizeof(keywords) / sizeof(keywords[0]); i++) {
    if (strlen(keywords[i]) == length && strncmp(buffer, keywords[i], length) == 0) {
      return true;
    }
  }

  return false;
}

static bool scan_block_comment_after_slash(TSLexer *lexer) {
  if (lexer->lookahead != '*') return false;
  advance(lexer);
  while (lexer->lookahead) {
    if (lexer->lookahead == '*') {
      advance(lexer);
      if (lexer->lookahead == '/') {
        skip(lexer);
        return true;
      }
      continue;
    }
    skip(lexer);
  }
  return false;
}

static void skip_ws_and_comments(TSLexer *lexer) {
  for (;;) {
    skip_spaces(lexer);
    if (lexer->lookahead != '/') return;

    lexer->mark_end(lexer);
    if (scan_line_comment(lexer) || scan_block_comment(lexer)) {
      continue;
    }
    return;
  }
}

static void skip_ws_and_comments_no_mark(TSLexer *lexer) {
  for (;;) {
    skip_spaces(lexer);
    if (lexer->lookahead != '/') return;

    advance(lexer);
    if (scan_line_comment_after_slash(lexer) || scan_block_comment_after_slash(lexer)) {
      continue;
    }
    return;
  }
}

static bool scan_keyword(TSLexer *lexer, const char *keyword) {
  for (size_t i = 0; keyword[i] != '\0'; i++) {
    if (lexer->lookahead != keyword[i]) return false;
    advance(lexer);
  }

  if (is_identifier_char(lexer->lookahead)) return false;
  return true;
}

static bool scan_directive_name(TSLexer *lexer, const char *name) {
  skip_ws_and_comments(lexer);
  if (lexer->lookahead != '#') return false;
  advance(lexer);

  while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
    skip(lexer);
  }

  return scan_keyword(lexer, name);
}

static bool scan_callback_signature_start(TSLexer *lexer) {
  if (lexer->lookahead != '<') return false;

  advance(lexer);
  int32_t next = lexer->lookahead;
  if (!(next == '>' || next == '_' || next == '%' || isalpha((unsigned char)next))) {
    return false;
  }

  lexer->mark_end(lexer);
  return true;
}

static DirectiveType scan_directive_type(TSLexer *lexer) {
  skip_ws_and_comments(lexer);
  if (lexer->lookahead != '#') return DIRECTIVE_NONE;
  advance(lexer);

  while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
    skip(lexer);
  }

  char name[8] = {0};
  size_t length = 0;
  while (is_identifier_char(lexer->lookahead) && length + 1 < sizeof(name)) {
    name[length++] = (char)lexer->lookahead;
    advance(lexer);
  }

  if (is_identifier_char(lexer->lookahead)) return DIRECTIVE_NONE;

  if (length == 2 && name[0] == 'i' && name[1] == 'f') return DIRECTIVE_IF;
  if (length == 4 && strcmp(name, "else") == 0) return DIRECTIVE_ELSE;
  if (length == 6 && strcmp(name, "elseif") == 0) return DIRECTIVE_ELSEIF;
  if (length == 5 && strcmp(name, "endif") == 0) return DIRECTIVE_ENDIF;
  return DIRECTIVE_NONE;
}

static bool scan_to_line_end(TSLexer *lexer) {
  bool saw_newline = false;

  while (lexer->lookahead) {
    if (lexer->lookahead == '\\') {
      advance(lexer);
      if (lexer->lookahead == '\r') {
        skip(lexer);
      }
      if (lexer->lookahead == '\n') {
        skip(lexer);
        saw_newline = true;
        continue;
      }
      continue;
    }

    if (lexer->lookahead == '\n') {
      skip(lexer);
      saw_newline = true;
      break;
    }

    skip(lexer);
  }

  return saw_newline || lexer->lookahead == 0;
}

static bool scan_directive_line_end(TSLexer *lexer) {
  for (;;) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') {
      skip(lexer);
    }

    if (lexer->lookahead != '/') {
      break;
    }

    lexer->mark_end(lexer);
    if (scan_line_comment(lexer) || scan_block_comment(lexer)) {
      continue;
    }

    break;
  }

  if (lexer->lookahead == '\n') {
    skip(lexer);
    return true;
  }

  return lexer->lookahead == 0;
}

static bool scan_parenthesized_condition(TSLexer *lexer) {
  skip_ws_and_comments(lexer);
  if (lexer->lookahead != '(') return false;

  int depth = 0;
  bool in_string = false;
  bool in_char = false;
  bool escaped = false;

  while (lexer->lookahead) {
    int32_t c = lexer->lookahead;
    advance(lexer);

    if (in_string) {
      if (!escaped && c == '"') in_string = false;
      escaped = !escaped && c == '\\';
      continue;
    }

    if (in_char) {
      if (!escaped && c == '\'') in_char = false;
      escaped = !escaped && c == '\\';
      continue;
    }

    if (c == '"') {
      in_string = true;
      escaped = false;
      continue;
    }

    if (c == '\'') {
      in_char = true;
      escaped = false;
      continue;
    }

    if (c == '(') {
      depth++;
      continue;
    }

    if (c == ')') {
      depth--;
      if (depth == 0) {
        return true;
      }
      continue;
    }
  }

  return false;
}

static bool scan_prefixed_if_branch_candidate(TSLexer *lexer, IfBranchKind *kind) {
  for (;;) {
    skip_ws_and_comments(lexer);

    if (lexer->lookahead == 0) {
      return false;
    }

    if (lexer->lookahead == '#') {
      return scan_nested_shared_if_header(lexer, kind);
    }

    skip_ws_and_comments(lexer);
    if (!scan_keyword(lexer, "if")) {
      if (!scan_to_line_end(lexer)) {
        return false;
      }
      continue;
    }

    if (!scan_parenthesized_condition(lexer)) {
      return false;
    }

    if (scan_directive_line_end(lexer)) {
      skip_ws_and_comments(lexer);
      if (lexer->lookahead == '#') {
        *kind = IF_BRANCH_HEADER;
        return true;
      }

      if (lexer->lookahead == '{') {
        uint32_t brace_column = lexer->get_column(lexer);
        advance(lexer);
        skip_ws_and_comments(lexer);
        if (lexer->lookahead == '#') {
          IfBranchKind block_kind = IF_BRANCH_NONE;
          if (lexer->get_column(lexer) > brace_column &&
              scan_block_tail_after_open_brace(lexer, &block_kind) &&
              block_kind == IF_BRANCH_HEADER_WITH_ELSE_BLOCK) {
            *kind = block_kind;
            return true;
          }

          *kind = IF_BRANCH_HEADER_WITH_BRACE;
          return true;
        }

        IfBranchKind block_kind = IF_BRANCH_NONE;
        if (scan_block_tail_after_open_brace(lexer, &block_kind) &&
            (block_kind == IF_BRANCH_HEADER_WITH_ELSE_BLOCK ||
             block_kind == IF_BRANCH_HEADER_WITH_BRACE ||
             block_kind == IF_BRANCH_HEADER_WITH_INLINE_ELSE)) {
          *kind = block_kind;
          return true;
        }
      }

      continue;
    }

    if (lexer->lookahead == '{') {
      return false;
    }

    if (!scan_to_line_end(lexer)) {
      return false;
    }

    skip_ws_and_comments(lexer);
    if (lexer->lookahead == '#') {
      *kind = IF_BRANCH_INLINE_STATEMENT;
      return true;
    }

    continue;
  }
}

static bool scan_nested_shared_if_header(TSLexer *lexer, IfBranchKind *kind) {
  if (scan_directive_type(lexer) != DIRECTIVE_IF) return false;

  for (;;) {
    if (!scan_to_line_end(lexer)) return false;

    IfBranchKind branch_kind = IF_BRANCH_NONE;
    if (!scan_prefixed_if_branch_candidate(lexer, &branch_kind) || branch_kind != IF_BRANCH_HEADER) {
      return false;
    }

    DirectiveType directive_type = scan_directive_type(lexer);
    if (directive_type == DIRECTIVE_ELSEIF || directive_type == DIRECTIVE_ELSE) {
      continue;
    }

    if (directive_type != DIRECTIVE_ENDIF) return false;
    if (!scan_to_line_end(lexer)) return false;

    skip_ws_and_comments(lexer);
    if (lexer->lookahead != '{') return false;
    advance(lexer);

    skip_ws_and_comments(lexer);
    if (lexer->lookahead == '#') {
      *kind = IF_BRANCH_HEADER_WITH_BRACE;
      return true;
    }

    IfBranchKind block_kind = IF_BRANCH_NONE;
    if (!scan_block_tail_after_open_brace(lexer, &block_kind) || block_kind != IF_BRANCH_HEADER_WITH_ELSE_BLOCK) {
      return false;
    }

    *kind = block_kind;
    return true;
  }
}

static bool scan_prefixed_if_header_before_directive(TSLexer *lexer) {
  IfBranchKind kind = IF_BRANCH_NONE;
  if (!scan_prefixed_if_branch_candidate(lexer, &kind)) return false;
  return kind == IF_BRANCH_HEADER;
}

static bool scan_prefixed_if_header_with_brace(TSLexer *lexer) {
  IfBranchKind kind = IF_BRANCH_NONE;
  if (!scan_prefixed_if_branch_candidate(lexer, &kind)) return false;
  return kind == IF_BRANCH_HEADER_WITH_BRACE;
}

static bool scan_prefixed_inline_if_statement_before_directive(TSLexer *lexer) {
  IfBranchKind kind = IF_BRANCH_NONE;
  if (!scan_prefixed_if_branch_candidate(lexer, &kind)) return false;
  return kind == IF_BRANCH_INLINE_STATEMENT;
}

static bool scan_unsupported_define_header(TSLexer *lexer) {
  if (lexer->lookahead == 0 || lexer->lookahead == '\n' || lexer->lookahead == '\r') return false;
  if (lexer->lookahead == '(' || lexer->lookahead == '/' || lexer->lookahead == ' ' || lexer->lookahead == '\t') return false;

  lexer->mark_end(lexer);

  while (lexer->lookahead) {
    if (lexer->lookahead == '\n' || lexer->lookahead == '\r' || lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '/') {
      return true;
    }

    advance(lexer);
    lexer->mark_end(lexer);
  }

  return true;
}

static bool scan_unsupported_macro_parameter_list(TSLexer *lexer) {
  if (lexer->lookahead != '(') return false;

  unsigned depth = 0;
  bool saw_unsupported = false;

  while (lexer->lookahead) {
    if (lexer->lookahead == '\n' || lexer->lookahead == '\r') return false;

    if (lexer->lookahead == '"' || lexer->lookahead == '\'') {
      int32_t quote = lexer->lookahead;
      saw_unsupported = true;
      advance(lexer);

      while (lexer->lookahead && lexer->lookahead != quote) {
        if (lexer->lookahead == '\\') {
          advance(lexer);
          if (!lexer->lookahead) return false;
        }

        if (lexer->lookahead == '\n' || lexer->lookahead == '\r') return false;
        advance(lexer);
      }

      if (lexer->lookahead != quote) return false;
      advance(lexer);
      continue;
    }

    if (lexer->lookahead == '(') {
      depth++;
      advance(lexer);
      continue;
    }

    if (lexer->lookahead == ')') {
      if (depth == 0) return false;
      depth--;
      advance(lexer);
      if (depth == 0) {
        lexer->mark_end(lexer);
        return saw_unsupported;
      }
      continue;
    }

    if (!isalnum(lexer->lookahead) && lexer->lookahead != '_' && lexer->lookahead != '%' && lexer->lookahead != ',' && lexer->lookahead != ':' && lexer->lookahead != '{' && lexer->lookahead != '}' && lexer->lookahead != ' ' && lexer->lookahead != '\t') {
      saw_unsupported = true;
    }

    advance(lexer);
  }

  return false;
}

static bool scan_keyword_define_value(TSLexer *lexer) {
  if (!isalpha(lexer->lookahead) && lexer->lookahead != '_') return false;

  char buffer[16] = {0};
  size_t length = 0;

  while (is_identifier_char(lexer->lookahead)) {
    if (length + 1 >= sizeof(buffer)) return false;
    buffer[length++] = (char)lexer->lookahead;
    advance(lexer);
  }

  if (!is_define_value_keyword(buffer, length)) return false;

  lexer->mark_end(lexer);

  for (;;) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') {
      skip(lexer);
    }

    if (lexer->lookahead != '/') {
      break;
    }

    advance(lexer);
    if (scan_line_comment_after_slash(lexer) || scan_block_comment_after_slash(lexer)) {
      lexer->mark_end(lexer);
      continue;
    }

    return false;
  }

  if (lexer->lookahead == '\n' || lexer->lookahead == 0) {
    return true;
  }

  return false;
}

static bool scan_opaque_define_value(TSLexer *lexer) {
  if (lexer->lookahead == 0 || lexer->lookahead == '\n' || lexer->lookahead == '\r') return false;

  bool is_escaped = false;
  bool ends_with_multiline_comment = false;
  bool in_string = false;
  bool in_char = false;
  int paren_depth = 0;
  int bracket_depth = 0;
  int brace_depth = 0;
  unsigned top_level_colons = 0;

  lexer->mark_end(lexer);

  for (;;) {
    if (lexer->lookahead == '/') {
      lexer->mark_end(lexer);
      advance(lexer);

      if (lexer->lookahead == '/') {
        return true;
      }

      if (lexer->lookahead == '*') {
        advance(lexer);
        bool end = false;
        while (!end) {
          if (lexer->lookahead == '\n' && !is_escaped) {
            return true;
          }

          if (lexer->lookahead != '\r') {
            is_escaped = lexer->lookahead == '\\';
          }

          if (lexer->lookahead != '*') {
            if (lexer->lookahead == 0) return true;
            advance(lexer);
            continue;
          }

          advance(lexer);
          end = lexer->lookahead == '/' || lexer->lookahead == 0;
        }

        ends_with_multiline_comment = true;
        if (lexer->lookahead == '/') {
          advance(lexer);
        }
        continue;
      }

      ends_with_multiline_comment = false;
    }

    if (!(lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r' || lexer->lookahead == '\n' || lexer->lookahead == 0) && ends_with_multiline_comment) {
      ends_with_multiline_comment = false;
    }

    if ((lexer->lookahead == '\n' && !is_escaped) || lexer->lookahead == 0) {
      if (!ends_with_multiline_comment) {
        lexer->mark_end(lexer);
      }
      return top_level_colons >= 2;
    }

    int32_t c = lexer->lookahead;

    if (in_string) {
      if (!is_escaped && c == '"') in_string = false;
    } else if (in_char) {
      if (!is_escaped && c == '\'') in_char = false;
    } else {
      if (c == '"') {
        in_string = true;
      } else if (c == '\'') {
        in_char = true;
      } else if (c == '(') {
        paren_depth++;
      } else if (c == ')' && paren_depth > 0) {
        paren_depth--;
      } else if (c == '[') {
        bracket_depth++;
      } else if (c == ']' && bracket_depth > 0) {
        bracket_depth--;
      } else if (c == '{') {
        brace_depth++;
      } else if (c == '}' && brace_depth > 0) {
        brace_depth--;
      } else if (c == ':' && paren_depth == 0 && bracket_depth == 0 && brace_depth == 0) {
        top_level_colons++;
      }
    }

    if (lexer->lookahead != '\r') {
      is_escaped = lexer->lookahead == '\\';
    }

    advance(lexer);
  }
}

static bool scan_balanced_block_followed_by_else(TSLexer *lexer) {
  skip_ws_and_comments_no_mark(lexer);
  if (lexer->lookahead != '{') return false;

  int depth = 0;
  bool in_string = false;
  bool in_char = false;
  bool escaped = false;

  while (lexer->lookahead) {
    int32_t c = lexer->lookahead;

    if (!in_string && !in_char && c == '/') {
      advance(lexer);
      if (scan_line_comment_after_slash(lexer) || scan_block_comment_after_slash(lexer)) {
        continue;
      }
      continue;
    }

    advance(lexer);

    if (in_string) {
      if (!escaped && c == '"') in_string = false;
      escaped = !escaped && c == '\\';
      continue;
    }

    if (in_char) {
      if (!escaped && c == '\'') in_char = false;
      escaped = !escaped && c == '\\';
      continue;
    }

    if (c == '"') {
      in_string = true;
      escaped = false;
      continue;
    }

    if (c == '\'') {
      in_char = true;
      escaped = false;
      continue;
    }

    if (c == '{') {
      depth++;
      continue;
    }

    if (c == '}') {
      depth--;
      if (depth == 0) {
        break;
      }
    }
  }

  if (depth != 0) return false;

  skip_ws_and_comments_no_mark(lexer);
  return scan_keyword(lexer, "else");
}

static bool scan_block_tail_after_open_brace(TSLexer *lexer, IfBranchKind *kind) {
  int depth = 1;
  bool first_token_after_open = true;
  bool saw_outer_endif = false;
  bool saw_shared_statement = false;
  bool saw_top_level_directive = false;
  bool in_string = false;
  bool in_char = false;
  bool escaped = false;

  while (lexer->lookahead) {
    int32_t c = lexer->lookahead;

    if (!in_string && !in_char && c == '/') {
      advance(lexer);
      if (scan_line_comment_after_slash(lexer) || scan_block_comment_after_slash(lexer)) {
        continue;
      }
      continue;
    }

    if (!in_string && !in_char && depth == 1 && !first_token_after_open && c == '#') {
      saw_top_level_directive = true;
      DirectiveType directive_type = scan_directive_type(lexer);

      if (!saw_outer_endif) {
        if (directive_type != DIRECTIVE_IF && directive_type != DIRECTIVE_ELSEIF && directive_type != DIRECTIVE_ELSE && directive_type != DIRECTIVE_ENDIF) {
          return false;
        }

        if (!scan_to_line_end(lexer)) return false;
        if (directive_type == DIRECTIVE_ENDIF) {
          lexer->mark_end(lexer);
          saw_outer_endif = true;
        }
        continue;
      }

      if (directive_type != DIRECTIVE_IF) {
        if (!scan_to_line_end(lexer)) return false;
        continue;
      }

      if (!scan_to_line_end(lexer)) return false;
      if (!saw_shared_statement) return false;

      skip_ws_and_comments_no_mark(lexer);
      if (lexer->lookahead != '}') return false;
      advance(lexer);

      skip_ws_and_comments_no_mark(lexer);
      if (lexer->lookahead == '#') {
        *kind = IF_BRANCH_HEADER_WITH_BRACE;
        return true;
      }

      if (!scan_keyword(lexer, "else")) return false;

      skip_ws_and_comments_no_mark(lexer);
      if (lexer->lookahead == '{' || lexer->lookahead == 0 || lexer->lookahead == '#') return false;
      if (!scan_to_line_end(lexer)) return false;

      skip_ws_and_comments_no_mark(lexer);
      if (scan_directive_type(lexer) != DIRECTIVE_ENDIF) return false;
      if (!scan_to_line_end(lexer)) return false;

      *kind = IF_BRANCH_HEADER_WITH_INLINE_ELSE;
      return true;
    }

    if (!in_string && !in_char && first_token_after_open) {
      if (c == ' ' || c == '\t' || c == '\r' || c == '\n') {
        advance(lexer);
        continue;
      }

      if (c == '#') {
        DirectiveType directive_type = scan_directive_type(lexer);
        if (directive_type == DIRECTIVE_IF) {
          if (!scan_to_line_end(lexer)) return false;
          first_token_after_open = false;
          continue;
        }

        if (directive_type == DIRECTIVE_ELSEIF || directive_type == DIRECTIVE_ELSE || directive_type == DIRECTIVE_ENDIF) {
          *kind = IF_BRANCH_HEADER_WITH_BRACE;
          return true;
        }

        return false;
      }

      first_token_after_open = false;
    }

    if (!in_string && !in_char && depth == 1 && saw_outer_endif && !saw_shared_statement &&
        c != ' ' && c != '\t' && c != '\r' && c != '\n' && c != '#' && c != '}') {
      saw_shared_statement = true;
    }

    advance(lexer);

    if (in_string) {
      if (!escaped && c == '"') in_string = false;
      escaped = !escaped && c == '\\';
      continue;
    }

    if (in_char) {
      if (!escaped && c == '\'') in_char = false;
      escaped = !escaped && c == '\\';
      continue;
    }

    if (c == '"') {
      in_string = true;
      escaped = false;
      continue;
    }

    if (c == '\'') {
      in_char = true;
      escaped = false;
      continue;
    }

    if (c == '{') {
      depth++;
      continue;
    }

    if (c == '}') {
      depth--;
      if (depth == 0) {
        break;
      }
    }
  }

  if (depth != 0) return false;

  skip_ws_and_comments_no_mark(lexer);

  if (lexer->lookahead == '#') {
    DirectiveType directive_type = scan_directive_type(lexer);
    if (!saw_top_level_directive && directive_type == DIRECTIVE_ENDIF) {
      return false;
    }

    *kind = IF_BRANCH_HEADER_WITH_BRACE;
    return true;
  }

  if (!scan_keyword(lexer, "else")) return false;

  skip_ws_and_comments(lexer);
  if (lexer->lookahead != '{') return false;
  advance(lexer);

  skip_ws_and_comments(lexer);
  if (lexer->lookahead != '#') return false;

  *kind = IF_BRANCH_HEADER_WITH_ELSE_BLOCK;
  return true;
}

// Recognize only the scanner-backed shared-if families that the grammar cannot
// express safely with local tokens alone:
// 1. directive-selected `if (...) {` branches with a shared closing brace,
// 2. directive-selected `if (...) { ... } else ...` branches, and
// 3. directive-selected inline `if (...) stmt;` branches with a shared `else if`, and
// 4. directive-selected prefixed `if (...)` headers with a shared block body.
static bool scan_conditional_if_preamble_token(TSLexer *lexer, const bool *valid_symbols, enum TokenType *result_symbol) {
  IfBranchKind kind = IF_BRANCH_NONE;

  if (!scan_directive_line_end(lexer)) return false;
  if (!scan_prefixed_if_branch_candidate(lexer, &kind)) return false;

  if (kind == IF_BRANCH_INLINE_STATEMENT) {
    if (!valid_symbols[CONDITIONAL_IF_ELSE_IF_PREAMBLE]) return false;

    for (;;) {
      DirectiveType directive_type = scan_directive_type(lexer);
      if (directive_type == DIRECTIVE_ELSEIF || directive_type == DIRECTIVE_ELSE) {
        if (!scan_to_line_end(lexer)) return false;
        if (!scan_prefixed_inline_if_statement_before_directive(lexer)) return false;
        continue;
      }

      if (directive_type != DIRECTIVE_ENDIF) return false;
      if (!scan_to_line_end(lexer)) return false;
      lexer->mark_end(lexer);

      skip_ws_and_comments(lexer);
      if (!scan_keyword(lexer, "else")) return false;
      skip_ws_and_comments(lexer);
      if (!scan_keyword(lexer, "if")) return false;

      *result_symbol = CONDITIONAL_IF_ELSE_IF_PREAMBLE;
      return true;
    }
  }

  skip_ws_and_comments(lexer);

  if (kind == IF_BRANCH_HEADER_WITH_INLINE_ELSE) {
    if (!valid_symbols[CONDITIONAL_IF_WRAPPED_ELSE_PREAMBLE]) return false;
    *result_symbol = CONDITIONAL_IF_WRAPPED_ELSE_PREAMBLE;
    return true;
  }

  if (kind == IF_BRANCH_HEADER) {
    for (;;) {
      DirectiveType directive_type = scan_directive_type(lexer);
      if (directive_type == DIRECTIVE_ELSEIF || directive_type == DIRECTIVE_ELSE) {
        if (!scan_to_line_end(lexer)) return false;
        if (!scan_prefixed_if_header_before_directive(lexer)) return false;
        continue;
      }

      if (directive_type != DIRECTIVE_ENDIF) return false;
      if (!scan_to_line_end(lexer)) return false;
      lexer->mark_end(lexer);

      skip_ws_and_comments(lexer);
      if (lexer->lookahead != '{') return false;

      if (valid_symbols[CONDITIONAL_IF_ELSE_PREAMBLE] && scan_balanced_block_followed_by_else(lexer)) {
        *result_symbol = CONDITIONAL_IF_ELSE_PREAMBLE;
        return true;
      }

      if (!valid_symbols[CONDITIONAL_IF_BLOCK_PREAMBLE]) return false;

      *result_symbol = CONDITIONAL_IF_BLOCK_PREAMBLE;
      return true;
    }
  }

  if (kind == IF_BRANCH_HEADER_WITH_BRACE) {
    if (!valid_symbols[CONDITIONAL_IF_PREAMBLE] && !valid_symbols[CONDITIONAL_IF_ELSE_BLOCK_PREAMBLE]) {
      return false;
    }
    for (;;) {
      lexer->mark_end(lexer);
      DirectiveType directive_type = scan_directive_type(lexer);
      if (directive_type == DIRECTIVE_IF) {
        if (!valid_symbols[CONDITIONAL_IF_ELSE_BLOCK_PREAMBLE]) return false;
        if (!scan_to_line_end(lexer)) return false;

        IfBranchKind block_kind = IF_BRANCH_NONE;
        if (!scan_block_tail_after_open_brace(lexer, &block_kind) || block_kind != IF_BRANCH_HEADER_WITH_ELSE_BLOCK) {
          return false;
        }

        if (scan_directive_type(lexer) != DIRECTIVE_ENDIF) return false;
        if (!scan_to_line_end(lexer)) return false;
        *result_symbol = CONDITIONAL_IF_ELSE_BLOCK_PREAMBLE;
        return true;
      }

      if (directive_type == DIRECTIVE_ELSEIF || directive_type == DIRECTIVE_ELSE) {
        if (!valid_symbols[CONDITIONAL_IF_PREAMBLE]) return false;
        if (!scan_to_line_end(lexer)) return false;
        if (!scan_prefixed_if_header_with_brace(lexer)) return false;
        continue;
      }

      if (directive_type != DIRECTIVE_ENDIF) return false;
      if (!scan_to_line_end(lexer)) return false;
      if (!valid_symbols[CONDITIONAL_IF_PREAMBLE]) return false;
      lexer->mark_end(lexer);
      *result_symbol = CONDITIONAL_IF_PREAMBLE;
      return true;
    }
  }

  if (kind == IF_BRANCH_HEADER_WITH_ELSE_BLOCK) {
    if (!valid_symbols[CONDITIONAL_IF_ELSE_BLOCK_PREAMBLE]) return false;
    for (;;) {
      DirectiveType directive_type = scan_directive_type(lexer);
      if (directive_type == DIRECTIVE_ENDIF) {
        if (!scan_to_line_end(lexer)) return false;
        lexer->mark_end(lexer);
        *result_symbol = CONDITIONAL_IF_ELSE_BLOCK_PREAMBLE;
        return true;
      }

      if (directive_type != DIRECTIVE_ELSEIF && directive_type != DIRECTIVE_ELSE) return false;
      if (!scan_to_line_end(lexer)) return false;

      IfBranchKind alternative_kind = IF_BRANCH_NONE;
      if (!scan_prefixed_if_branch_candidate(lexer, &alternative_kind) || alternative_kind != IF_BRANCH_INLINE_STATEMENT) {
        return false;
      }
    }
  }

  if (!valid_symbols[CONDITIONAL_IF_ELSE_PREAMBLE]) return false;

  if (scan_directive_type(lexer) != DIRECTIVE_ELSE) return false;
  if (!scan_to_line_end(lexer)) return false;
  if (!scan_prefixed_if_header_before_directive(lexer)) return false;
  if (scan_directive_type(lexer) != DIRECTIVE_ENDIF) return false;
  if (!scan_to_line_end(lexer)) return false;

  lexer->mark_end(lexer);
  if (!scan_balanced_block_followed_by_else(lexer)) return false;
  *result_symbol = CONDITIONAL_IF_ELSE_PREAMBLE;
  return true;
}

// This closing token is only for the shared brace-wrapped `if (...) {` form.
static bool scan_conditional_if_closing(TSLexer *lexer) {
  skip_ws_and_comments(lexer);
  if (scan_directive_type(lexer) != DIRECTIVE_IF) return false;
  if (!scan_to_line_end(lexer)) return false;

  skip_ws_and_comments(lexer);
  if (lexer->lookahead != '}') return false;
  advance(lexer);

  if (!scan_directive_name(lexer, "endif")) return false;
  if (!scan_to_line_end(lexer)) return false;
  lexer->mark_end(lexer);
  return true;
}

static bool scan_conditional_if_else_closing(TSLexer *lexer) {
  skip_ws_and_comments(lexer);
  if (scan_directive_type(lexer) != DIRECTIVE_IF) return false;
  if (!scan_to_line_end(lexer)) return false;

  skip_ws_and_comments(lexer);
  if (lexer->lookahead != '}') return false;
  advance(lexer);
  lexer->mark_end(lexer);

  skip_ws_and_comments_no_mark(lexer);
  if (!scan_keyword(lexer, "else")) return false;
  skip_ws_and_comments_no_mark(lexer);
  if (lexer->lookahead == '{' || lexer->lookahead == 0 || lexer->lookahead == '#') return false;
  if (!scan_to_line_end(lexer)) return false;

  skip_ws_and_comments_no_mark(lexer);
  if (scan_directive_type(lexer) != DIRECTIVE_ENDIF) return false;
  if (!scan_to_line_end(lexer)) return false;
  return true;
}

void *tree_sitter_pawn_external_scanner_create(void) {
  return NULL;
}

void tree_sitter_pawn_external_scanner_destroy(void *payload) {
  (void)payload;
}

unsigned tree_sitter_pawn_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_pawn_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_pawn_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  (void)payload;

  if (valid_symbols[CALLBACK_SIGNATURE_START] && scan_callback_signature_start(lexer)) {
    lexer->result_symbol = CALLBACK_SIGNATURE_START;
    return true;
  }

  if (valid_symbols[OPAQUE_DEFINE_VALUE] && (scan_keyword_define_value(lexer) || scan_opaque_define_value(lexer))) {
    lexer->result_symbol = OPAQUE_DEFINE_VALUE;
    return true;
  }

  if (valid_symbols[UNSUPPORTED_DEFINE_HEADER] && scan_unsupported_define_header(lexer)) {
    lexer->result_symbol = UNSUPPORTED_DEFINE_HEADER;
    return true;
  }

  if (valid_symbols[UNSUPPORTED_MACRO_PARAMETER_LIST] && scan_unsupported_macro_parameter_list(lexer)) {
    lexer->result_symbol = UNSUPPORTED_MACRO_PARAMETER_LIST;
    return true;
  }

  if (valid_symbols[CONDITIONAL_IF_ELSE_CLOSING] && scan_conditional_if_else_closing(lexer)) {
    lexer->result_symbol = CONDITIONAL_IF_ELSE_CLOSING;
    return true;
  }

  if (valid_symbols[CONDITIONAL_IF_CLOSING] && scan_conditional_if_closing(lexer)) {
    lexer->result_symbol = CONDITIONAL_IF_CLOSING;
    return true;
  }

  enum TokenType result_symbol = CONDITIONAL_IF_ELSE_PREAMBLE;
  if ((valid_symbols[CONDITIONAL_IF_ELSE_PREAMBLE] || valid_symbols[CONDITIONAL_IF_ELSE_IF_PREAMBLE] || valid_symbols[CONDITIONAL_IF_BLOCK_PREAMBLE] || valid_symbols[CONDITIONAL_IF_ELSE_BLOCK_PREAMBLE] || valid_symbols[CONDITIONAL_IF_PREAMBLE] || valid_symbols[CONDITIONAL_IF_WRAPPED_ELSE_PREAMBLE]) &&
      scan_conditional_if_preamble_token(lexer, valid_symbols, &result_symbol)) {
    lexer->result_symbol = result_symbol;
    return true;
  }

  return false;
}