#!/bin/bash

echo "🔄 Migrando de authenticate (JWT) a clerkAuth"
echo ""

# Contador
updated=0

# Lista de archivos de rutas
ROUTE_FILES=(
  "src/routes/authRoutes.mjs"
  "src/routes/userRoutes.mjs"
  "src/routes/projectRoutes.mjs"
  "src/routes/milestoneRoutes.mjs"
  "src/routes/cashFlowRoutes.mjs"
  "src/routes/reportRoutes.mjs"
  "src/routes/incomeRoutes.mjs"
  "src/routes/incomeCategoriesRoutes.mjs"
  "src/routes/factoringRoutes.mjs"
  "src/routes/factoringEntityRoutes.mjs"
  "src/routes/accountCategoryRoutes.mjs"
  "src/routes/budgetSuggestionsRoutes.mjs"
  "src/routes/CC/previsionalRoutes.mjs"
  "src/routes/CC/remuneracionRoutes.mjs"
  "src/routes/CC/ordenCompraRoutes.mjs"
  "src/routes/CC/OrdenCompraItemRoutes.mjs"
  "src/routes/CC/multidimensionalRoutes.mjs"
  "src/routes/CC/fixedCostsRoutes.mjs"
  "src/routes/CC/empleadosRoutes.mjs"
)

# Backup directory
BACKUP_DIR="backups/routes-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creando backups en: $BACKUP_DIR"
echo ""

for file in "${ROUTE_FILES[@]}"; do
  if [ -f "$file" ]; then
    # Hacer backup
    cp "$file" "$BACKUP_DIR/$(basename $file)"
    
    # Reemplazar import
    sed -i.bak "s/import { authenticate/import { authenticate as authenticateOld/g" "$file"
    sed -i.bak "s/from '\.\.\/middleware\/auth\.mjs'/from '..\/middleware\/auth.mjs'; import { clerkAuth as authenticate } from '..\/middleware\/clerkAuth.mjs'/g" "$file"
    
    # Limpiar archivos .bak
    rm -f "${file}.bak"
    
    echo "✅ Actualizado: $file"
    ((updated++))
  else
    echo "⚠️  No existe: $file"
  fi
done

echo ""
echo "📊 Total actualizado: $updated archivos"
echo "💾 Backups guardados en: $BACKUP_DIR"
echo ""
echo "⚠️  IMPORTANTE: Revisa manualmente cada archivo para confirmar los cambios"