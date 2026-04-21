#include <tree_sitter/parser.h>

#include <ctype.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

enum TokenType {
  CONDITIONAL_IF_ELSE_PREAMBLE,
  CONDITIONAL_IF_PREAMBLE,
  CONDITIONAL_IF_CLOSING,
};

typedef enum {
  DIRECTIVE_NONE,
  DIRECTIVE_IF,
  DIRECTIVE_ELSE,
  DIRECTIVE_ELSEIF,
  DIRECTIVE_ENDIF,
} DirectiveType;

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

static bool scan_if_header(TSLexer *lexer) {
  skip_ws_and_comments(lexer);
  if (!scan_keyword(lexer, "if")) return false;
  return scan_parenthesized_condition(lexer);
}

static bool scan_if_header_with_brace(TSLexer *lexer) {
  if (!scan_if_header(lexer)) return false;
  skip_ws_and_comments(lexer);
  if (lexer->lookahead != '{') return false;
  advance(lexer);
  return true;
}

static bool scan_balanced_block_followed_by_else(TSLexer *lexer) {
  skip_ws_and_comments(lexer);
  if (lexer->lookahead != '{') return false;

  int depth = 0;
  bool in_string = false;
  bool in_char = false;
  bool escaped = false;

  while (lexer->lookahead) {
    int32_t c = lexer->lookahead;

    if (!in_string && !in_char && c == '/') {
      lexer->mark_end(lexer);
      if (scan_line_comment(lexer) || scan_block_comment(lexer)) {
        continue;
      }
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

  skip_ws_and_comments(lexer);
  return scan_keyword(lexer, "else");
}

static bool scan_conditional_if_preamble_token(TSLexer *lexer, const bool *valid_symbols, enum TokenType *result_symbol) {
  skip_ws_and_comments(lexer);
  if (!scan_if_header(lexer)) return false;

  skip_ws_and_comments(lexer);

  if (lexer->lookahead == '{') {
    if (!valid_symbols[CONDITIONAL_IF_PREAMBLE]) return false;
    advance(lexer);

    for (;;) {
      DirectiveType directive_type = scan_directive_type(lexer);
      if (directive_type == DIRECTIVE_ELSEIF) {
        if (!scan_to_line_end(lexer)) return false;
        if (!scan_if_header_with_brace(lexer)) return false;
        continue;
      }

      if (directive_type != DIRECTIVE_ENDIF) return false;
      if (!scan_to_line_end(lexer)) return false;
      lexer->mark_end(lexer);
      *result_symbol = CONDITIONAL_IF_PREAMBLE;
      return true;
    }
  }

  if (!valid_symbols[CONDITIONAL_IF_ELSE_PREAMBLE]) return false;

  if (scan_directive_type(lexer) != DIRECTIVE_ELSE) return false;
  if (!scan_to_line_end(lexer)) return false;
  if (!scan_if_header(lexer)) return false;
  if (scan_directive_type(lexer) != DIRECTIVE_ENDIF) return false;
  if (!scan_to_line_end(lexer)) return false;

  lexer->mark_end(lexer);
  if (!scan_balanced_block_followed_by_else(lexer)) return false;
  *result_symbol = CONDITIONAL_IF_ELSE_PREAMBLE;
  return true;
}

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

  if (valid_symbols[CONDITIONAL_IF_CLOSING] && scan_conditional_if_closing(lexer)) {
    lexer->result_symbol = CONDITIONAL_IF_CLOSING;
    return true;
  }

  enum TokenType result_symbol = CONDITIONAL_IF_ELSE_PREAMBLE;
  if ((valid_symbols[CONDITIONAL_IF_ELSE_PREAMBLE] || valid_symbols[CONDITIONAL_IF_PREAMBLE]) &&
      scan_conditional_if_preamble_token(lexer, valid_symbols, &result_symbol)) {
    lexer->result_symbol = result_symbol;
    return true;
  }

  return false;
}