//go:build ignore

package main

import (
	"embed"
	"fmt"
	"io/fs"
)

//go:embed all:frontend/dist/browser
var assets embed.FS

func main() {
	fmt.Println("Root entries:")
	entries, _ := fs.ReadDir(assets, ".")
	for _, e := range entries {
		fmt.Printf("  %s (dir=%v)\n", e.Name(), e.IsDir())
	}

	fmt.Println("\nfrontend/dist/browser entries:")
	entries, err := fs.ReadDir(assets, "frontend/dist/browser")
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
	} else {
		for _, e := range entries {
			fmt.Printf("  %s (dir=%v)\n", e.Name(), e.IsDir())
		}
	}

	fmt.Println("\nTrying fs.Sub:")
	subFS, err := fs.Sub(assets, "frontend/dist/browser")
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
	} else {
		entries, _ := fs.ReadDir(subFS, ".")
		for _, e := range entries {
			fmt.Printf("  %s (dir=%v)\n", e.Name(), e.IsDir())
		}
	}

	fmt.Println("\nReading index.html:")
	content, err := fs.ReadFile(subFS, "index.html")
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
	} else {
		fmt.Printf("  Size: %d bytes\n", len(content))
		fmt.Printf("  First 200 chars: %s\n", string(content[:min(200, len(content))]))
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
