#!/bin/sh
# Build the Java engine into java-engine/out/organ-engine.jar (requires JDK 17+)
set -e
cd "$(dirname "$0")"
rm -rf out
mkdir -p out/classes
find src -name "*.java" > out/sources.txt
javac -d out/classes @out/sources.txt
printf "Main-Class: com.organregistry.Main\n" > out/manifest.txt
jar cfm out/organ-engine.jar out/manifest.txt -C out/classes .
echo "Built out/organ-engine.jar"
echo "  Demo:   java -jar out/organ-engine.jar"
echo "  Bridge: java -cp out/organ-engine.jar com.organregistry.bridge.EngineCli"
