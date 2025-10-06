#!/bin/bash

echo "╔════════════════════════════════════════════════════╗"
echo "║   🔄 Migración Masiva: JWT → Clerk Auth           ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Crear backup con timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups/routes-migration-$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

echo "📦 Creando backup en: $BACKUP_DIR"
cp -r src/routes "$BACKUP_DIR/"
echo "✅ Backup completado"
echo ""

# Lista de archivos a actualizar
ROUTE_FILES=(
  "src/routes/accountCategoryRoutes.mjs"
  "src/routes/budgetSuggestionsRoutes.mjs"
  "src/routes/cashFlowRoutes.mjs"
  "src/routes/companyUsersRoutes.mjs"
  "src/routes/factoringRoutes.mjs"
  "src/routes/incomeCategoriesRoutes.mjs"
  "src/routes/incomeRoutes.mjs"
  "src/routes/milestoneRoutes.mjs"
  "src/routes/projectRoutes.mjs"
  "src/routes/reportRoutes.mjs"
  "src/routes/userRoutes.mjs"
  "src/routes/CC/empleadosRoutes.mjs"
  "src/routes/CC/fixedCostsRoutes.mjs"
  "src/routes/CC/multidimensionalRoutes.mjs"
  "src/routes/CC/OrdenCompraItemRoutes.mjs"
  "src/routes/CC/ordenCompraRoutes.mjs"
  "src/routes/CC/previsionalRoutes.mjs"
  "src/routes/CC/remuneracionRoutes.mjs"
)

# NOTA: authRoutes.mjs NO se actualiza porque tiene rutas públicas

echo "🔍 Archivos a actualizar: ${#ROUTE_FILES[@]}"
echo ""

updated=0
skipped=0

for file in "${ROUTE_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⚠️  SKIP: $file (no existe)"
    ((skipped++))
    continue
  fi
  
  # Verificar si ya tiene clerkAuth
  if grep -q "clerkAuth" "$file"; then
    echo "⏭️  SKIP: $file (ya migrado)"
    ((skipped++))
    continue
  fi
  
  # Determinar el nivel de directorio para el import
  if [[ "$file" == *"/CC/"* ]]; then
    # Rutas en subdirectorio CC/ necesitan ../../
    sed -i.bak \
      "s|import { authenticate } from '\.\./\.\./middleware/auth\.mjs';|import { clerkAuth as authenticate } from '../../middleware/clerkAuth.mjs';|g" \
      "$file"
  else
    # Rutas en directorio raíz necesitan ../
    sed -i.bak \
      "s|import { authenticate } from '\.\./middleware/auth\.mjs';|import { clerkAuth as authenticate } from '../middleware/clerkAuth.mjs';|g" \
      "$file"
  fi
  
  # También actualizar otros imports comunes
  sed -i.bak \
    "s|import { authenticate, authorize } from '\.\./middleware/auth\.mjs';|import { clerkAuth as authenticate, authorize } from '../middleware/clerkAuth.mjs';|g" \
    "$file"
  
  sed -i.bak \
    "s|import { authenticate, authorize } from '\.\./\.\./middleware/auth\.mjs';|import { clerkAuth as authenticate, authorize } from '../../middleware/clerkAuth.mjs';|g" \
    "$file"
  
  # Limpiar archivos .bak
  rm -f "${file}.bak"
  
  echo "✅ Actualizado: $file"
  ((updated++))
done

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║              📊 RESUMEN DE MIGRACIÓN               ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo "✅ Archivos actualizados: $updated"
echo "⏭️  Archivos omitidos: $skipped"
echo "📦 Backup guardado en: $BACKUP_DIR"
echo ""
echo "🔍 Para verificar cambios:"
echo "   git diff src/routes/"
echo ""
echo "↩️  Para revertir todos los cambios:"
echo "   cp -r $BACKUP_DIR/routes/* src/routes/"
echo ""
echo "⚠️  IMPORTANTE: Revisa que el servidor inicie sin errores"
echo "   npm run dev"