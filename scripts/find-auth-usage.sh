#!/bin/bash

echo "🔍 Buscando archivos que usan 'authenticate' middleware..."
echo ""

# Buscar en rutas
echo "📁 RUTAS (src/routes/):"
grep -r "authenticate" src/routes/ --include="*.mjs" | cut -d: -f1 | sort -u | while read file; do
  echo "  ✅ $file"
done

echo ""

# Buscar en controladores
echo "🎮 CONTROLADORES (src/controllers/):"
grep -r "authenticate" src/controllers/ --include="*.mjs" | cut -d: -f1 | sort -u | while read file; do
  echo "  ✅ $file"
done

echo ""
echo "💡 Total de archivos encontrados:"
grep -r "authenticate" src/ --include="*.mjs" | cut -d: -f1 | sort -u | wc -l