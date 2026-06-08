#!/bin/bash
while true; do
  # Start tunnel and capture URL
  ssh -R 80:localhost:3177 nokey@localhost.run 2>&1 | while read line; do
    echo "$line"
    if [[ $line == *"localhost.run"* ]]; then
      URL=$(echo "$line" | grep -o 'https://[^ ]*')
      if [ ! -z "$URL" ]; then
        echo "{ \"base_url\": \"$URL\" }" > ~/todobackend/config.json
        cd ~/todobackend
        git add config.json
        git commit -m "update tunnel url"
        git push
        echo "URL updated: $URL"
      fi
    fi
  done
  sleep 5
done