#!/bin/bash

echo "Starting Angular apps from current workspace..."

# Base directory (where script is executed)
BASE_DIR=$(pwd)

apps=(
"admin-panel 4200"
"customer-app 4201"
"vendor-app 4202"
"delivery-app 4203"
)

for app in "${apps[@]}"
do
  folder=$(echo $app | awk '{print $1}')
  port=$(echo $app | awk '{print $2}')

  FULL_PATH="$BASE_DIR/$folder"

  echo "Starting $folder on port $port..."

  start cmd /k "cd /d $FULL_PATH && ng serve --port $port"
done

echo "All Angular apps started!"