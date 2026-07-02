#include <tree_sitter/parser.h>

#include <ctype.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

// The external scanner is intentionally narrow: it recognizes the immediate
// `<` that opens callback signatures without stealing bare `i<10` relational
// expressions, line-sensitive statement and directive terminators, and the
// two unsupported macro-header shapes that need bounded recovery.
enum TokenType {
  CALLBACK_SIGNATURE_START,
  STATEMENT_LINE_TERMINATOR,
  DIRECTIVE_LINE_TERMINATOR,
  UNSUPPORTED_DEFINE_HEADER,
  UNSUPPORTED_MACRO_PARAMETER_LIST,
};

static bool scan_callback_signature_start(TSLexer *lexer);
static bool scan_statement_line_terminator(TSLexer *lexer);
static bool scan_directive_line_terminator(TSLexer *lexer);
static bool scan_line_comment_after_slash(TSLexer *lexer);
static bool scan_block_comment_after_slash(TSLexer *lexer);
static bool scan_unsupported_define_header(TSLexer *lexer);
static bool scan_unsupported_macro_parameter_list(TSLexer *lexer);

static inline void advance(TSLexer *lexer) {
  lexer->advance(lexer, false);
}

static inline void skip(TSLexer *lexer) {
  lexer->advance(lexer, true);
}

static bool is_identifier_char(int32_t c) {
  return isalnum(c) || c == '_';
}

static bool scan_line_comment_after_slash(TSLexer *lexer) {
  if (lexer->lookahead != '/') return false;
  advance(lexer);
  while (lexer->lookahead && lexer->lookahead != '\n') {
    skip(lexer);
  }
  return true;
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

static bool scan_callback_signature_start(TSLexer *lexer) {
  if (lexer->lookahead != '<') return false;

  advance(lexer);
  lexer->mark_end(lexer);
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') {
    skip(lexer);
  }

  bool saw_content = false;
  if (lexer->lookahead == '>') {
    return true;
  }

  if (lexer->lookahead == '_') {
    saw_content = true;
    advance(lexer);
  } else if (lexer->lookahead == '%') {
    saw_content = true;
    advance(lexer);
    if (!is_identifier_char(lexer->lookahead)) {
      return false;
    }
    while (is_identifier_char(lexer->lookahead)) {
      advance(lexer);
    }
  } else if (isalpha((unsigned char)lexer->lookahead)) {
    saw_content = true;
    while (is_identifier_char(lexer->lookahead)) {
      advance(lexer);
    }
  } else {
    return false;
  }

  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') {
    skip(lexer);
  }

  if (lexer->lookahead != '>') {
    return false;
  }

  advance(lexer);
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') {
    skip(lexer);
  }

  if (saw_content) {
    if (lexer->lookahead == 0 || lexer->lookahead == '\n' || lexer->lookahead == ';') {
      return false;
    }

    if (lexer->lookahead == '/') {
      advance(lexer);
      if (scan_line_comment_after_slash(lexer)) {
        return false;
      }
      if (scan_block_comment_after_slash(lexer)) {
        while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') {
          skip(lexer);
        }
        if (lexer->lookahead == 0 || lexer->lookahead == '\n' || lexer->lookahead == ';') {
          return false;
        }
      } else {
        return false;
      }
    }
  }

  return true;
}

static bool is_statement_continuation_char(int32_t c) {
  switch (c) {
    case '(':
    case '[':
    case '.':
    case ',':
    case '?':
    case ':':
    case '+':
    case '-':
    case '*':
    case '/':
    case '%':
    case '<':
    case '>':
    case '=':
    case '!':
    case '&':
    case '|':
    case '^':
      return true;
    default:
      return false;
  }
}

static bool scan_statement_line_terminator(TSLexer *lexer) {
  for (;;) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') {
      skip(lexer);
    }

    if (lexer->lookahead == '\\') {
      advance(lexer);
      if (lexer->lookahead == '\r') {
        skip(lexer);
      }
      if (lexer->lookahead == '\n') {
        skip(lexer);
        continue;
      }
      return false;
    }

    if (lexer->lookahead != '/') {
      break;
    }

    advance(lexer);
    if (scan_line_comment_after_slash(lexer) || scan_block_comment_after_slash(lexer)) {
      continue;
    }

    return false;
  }

  if (lexer->lookahead == 0) {
    lexer->mark_end(lexer);
    return true;
  }

  if (lexer->lookahead != '\n') {
    return false;
  }

  skip(lexer);
  lexer->mark_end(lexer);

  for (;;) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r' || lexer->lookahead == '\n') {
      skip(lexer);
    }

    if (lexer->lookahead != '/') {
      break;
    }

    advance(lexer);
    if (scan_line_comment_after_slash(lexer) || scan_block_comment_after_slash(lexer)) {
      continue;
    }

    return false;
  }

  if (lexer->lookahead == 0) {
    return true;
  }

  if (lexer->lookahead == '{') {
    return false;
  }

  return !is_statement_continuation_char(lexer->lookahead);
}

static bool scan_directive_line_terminator(TSLexer *lexer) {
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') {
    skip(lexer);
  }

  if (lexer->lookahead == 0) {
    lexer->mark_end(lexer);
    return true;
  }

  if (lexer->lookahead != '\n') return false;
  skip(lexer);
  lexer->mark_end(lexer);
  return true;
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
  bool just_opened_outer = false;

  while (lexer->lookahead) {
    if (lexer->lookahead == '\n' || lexer->lookahead == '\r') {
      if (depth == 0) return false;
      lexer->mark_end(lexer);
      return true;
    }

    if (just_opened_outer) {
      if (lexer->lookahead == ' ' || lexer->lookahead == '\t') return false;
      just_opened_outer = false;
    }

    if (lexer->lookahead == '"' || lexer->lookahead == '\'') {
      int32_t quote = lexer->lookahead;
      saw_unsupported = true;
      advance(lexer);

      while (lexer->lookahead && lexer->lookahead != quote) {
        if (lexer->lookahead == '\\') {
          advance(lexer);
          if (!lexer->lookahead) return false;
        }

        if (lexer->lookahead == '\n' || lexer->lookahead == '\r') {
          lexer->mark_end(lexer);
          return depth > 0;
        }
        advance(lexer);
      }

      if (lexer->lookahead != quote) return false;
      advance(lexer);
      continue;
    }

    if (lexer->lookahead == '(') {
      depth++;
      if (depth == 1) just_opened_outer = true;
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

  if (depth == 0) return false;
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

  if (valid_symbols[CALLBACK_SIGNATURE_START] && scan_callback_signature_start(lexer)) {
    lexer->result_symbol = CALLBACK_SIGNATURE_START;
    return true;
  }

  if (valid_symbols[STATEMENT_LINE_TERMINATOR] && scan_statement_line_terminator(lexer)) {
    lexer->result_symbol = STATEMENT_LINE_TERMINATOR;
    return true;
  }

  if (valid_symbols[DIRECTIVE_LINE_TERMINATOR] && scan_directive_line_terminator(lexer)) {
    lexer->result_symbol = DIRECTIVE_LINE_TERMINATOR;
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

  return false;
}
