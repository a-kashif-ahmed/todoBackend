#!/bin/bash
trap "echo 'Stopping tunnel...'; exit 0" SIGINT SIGTERM

while true; do
  ssh -R 80:localhost:3177 nokey@localhost.run 2>&1 | while read line; do
    echo "$line"
    if [[ $line == *"lhr.life"* ]]; then
      URL=$(echo "$line" | grep -o 'https://[a-z0-9]*\.lhr\.life')
      if [ ! -z "$URL" ]; then
        echo "{\"base_url\":\"$URL\"}" > ~/todobackend/config.json
        cd ~/todobackend
        git add config.json
        git commit -m "update url"
        git push
        echo "URL updated: $URL"
      fi
    fi
  done
  sleep 5
done