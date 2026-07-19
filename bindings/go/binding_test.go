package tree_sitter_pawn_test

import (
	"testing"

	tree_sitter_pawn "github.com/pawnkit/tree-sitter-pawn/bindings/go"
	tree_sitter "github.com/tree-sitter/go-tree-sitter"
)

func TestLanguage(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_pawn.Language())
	parser := tree_sitter.NewParser()
	defer parser.Close()

	parser.SetLanguage(language)
	tree := parser.Parse([]byte("main() { return 0; }"), nil)
	defer tree.Close()

	if tree.RootNode().HasError() {
		t.Fatal("valid Pawn source produced an error node")
	}
}
