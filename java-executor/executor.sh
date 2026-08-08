#!/bin/sh
# Compile and run Java code
cd /code

# Compile
javac Main.java 2>&1
if [ $? -ne 0 ]; then
    exit 1
fi

# Run with input if exists
if [ -f input.txt ]; then
    java Main < input.txt
else
    java Main
fi