/*
 * If changed, have to run `npm run build-docker-builder-go`.
 * This script should be run after a period of time (180s), because the server may need some time to prepare.
 */
package main

import (
	"crypto/tls"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	// Is K8S + "dockge" as the container name
	// See https://github.com/louislam/uptime-kuma/pull/2083
	isK8s := strings.HasPrefix(os.Getenv("DOCKGE_PORT"), "tcp://")

	// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
	http.DefaultTransport.(*http.Transport).TLSClientConfig = &tls.Config{
		InsecureSkipVerify: true,
	}

	client := http.Client{
		Timeout: 28 * time.Second,
	}

	sslKey := os.Getenv("DOCKGE_SSL_KEY")
	sslCert := os.Getenv("DOCKGE_SSL_CERT")

	hostname := os.Getenv("DOCKGE_HOST")
	if len(hostname) == 0 {
		hostname = "127.0.0.1"
	}

	port := ""
	// DOCKGE_PORT is override by K8S unexpectedly,
	if !isK8s {
		port = os.Getenv("DOCKGE_PORT")
	}
	if len(port) == 0 {
		port = "5001"
	}

	protocol := ""
	if len(sslKey) != 0 && len(sslCert) != 0 {
		protocol = "https"
	} else {
		protocol = "http"
	}

	url := protocol + "://" + hostname + ":" + port

	log.Println("Checking " + url)
	resp, err := client.Get(url)

	if err != nil {
		log.Fatalln(err)
	}

	defer resp.Body.Close()

	_, err = ioutil.ReadAll(resp.Body)

	if err != nil {
		log.Fatalln(err)
	}

	log.Printf("Health Check OK [Res Code: %d]\n", resp.StatusCode)

}
