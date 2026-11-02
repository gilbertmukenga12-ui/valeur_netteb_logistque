// VNL-SAD pour Windows : petit serveur local qui sert l'application embarquée
// et l'ouvre dans une fenêtre Microsoft Edge en mode application.
// Les données restent dans le navigateur de l'ordinateur (stockage local de http://127.0.0.1:47831).
package main

import (
	"embed"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync/atomic"
	"time"
)

//go:embed www
var site embed.FS

const addr = "127.0.0.1:47831"
const url = "http://" + addr + "/"

var lastPing atomic.Int64

func openWindow() {
	// Edge est présent sur tous les Windows 10 à jour ; à défaut, navigateur par défaut.
	candidates := []string{
		filepath.Join(os.Getenv("ProgramFiles(x86)"), "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(os.Getenv("ProgramFiles"), "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(os.Getenv("LocalAppData"), "Microsoft", "Edge", "Application", "msedge.exe"),
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			if exec.Command(c, "--app="+url, "--window-size=1280,860").Start() == nil {
				return
			}
		}
	}
	exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}

func main() {
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		// Déjà lancé : on ouvre simplement une nouvelle fenêtre.
		openWindow()
		return
	}
	sub, _ := fs.Sub(site, "www")
	mux := http.NewServeMux()
	mux.HandleFunc("/ping", func(w http.ResponseWriter, r *http.Request) {
		lastPing.Store(time.Now().Unix())
		w.WriteHeader(http.StatusNoContent)
	})
	files := http.FileServer(http.FS(sub))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		files.ServeHTTP(w, r)
	}))
	lastPing.Store(time.Now().Unix() + 60) // délai de démarrage
	go func() {
		// Arrêt automatique deux minutes après la fermeture de la dernière fenêtre.
		for range time.Tick(15 * time.Second) {
			if time.Now().Unix()-lastPing.Load() > 120 {
				os.Exit(0)
			}
		}
	}()
	openWindow()
	http.Serve(ln, mux)
}
