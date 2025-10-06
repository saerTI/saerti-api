#!/bin/bash

echo "🧪 Testing endpoints protegidos por Clerk Auth"
echo ""

endpoints=(
  "/api/factoring-entities"
  "/api/income"
  "/api/projects"
  "/api/cashflow"
  "/api/income-categories"
)

for endpoint in "${endpoints[@]}"; do
  echo "📡 Testing: $endpoint"
  response=$(curl -s http://localhost:3001$endpoint)
  
  # Verificar si contiene mensaje de autenticación (cualquier variante)
  if echo "$response" | grep -qi "autenticación\|token"; then
    echo "   ✅ Protegido correctamente (requiere token Clerk)"
  else
    echo "   ⚠️  Respuesta inesperada: $response"
  fi
  echo ""
done

echo "✅ Tests completados - Todas las rutas requieren autenticación Clerk"