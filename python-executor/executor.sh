#!/bin/sh
# Run Python code
cd /code

# Run with input if exists
if [ -f input.txt ]; then
    python main.py < input.txt
else
    python main.py
fi