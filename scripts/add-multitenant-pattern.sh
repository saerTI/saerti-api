#!/bin/bash

echo "🏢 Lista de controladores a actualizar para multi-tenancy:"
echo ""

CONTROLLERS=(
  "src/controllers/factoringEntityController.mjs"
  "src/controllers/factoringController.mjs"
  "src/controllers/projectController.mjs"
  "src/controllers/cashFlowController.mjs"
  "src/controllers/incomeController.mjs"
  "src/controllers/CC/empleadosController.mjs"
  "src/controllers/CC/previsionalController.mjs"
  "src/controllers/CC/remuneracionController.mjs"
  "src/controllers/CC/ordenCompraController.mjs"
  "src/controllers/CC/fixedCostsController.mjs"
)

for controller in "${CONTROLLERS[@]}"; do
  if [ -f "$controller" ]; then
    echo "✅ $controller"
  else
    echo "⚠️  $controller (no existe)"
  fi
done

echo ""
echo "💡 Patrón a aplicar en cada método GET:"
echo ""
echo "const organizationId = req.user.organizationId;"
echo "if (!organizationId) {"
echo "  return res.status(400).json({ success: false, message: 'No organization found' });"
echo "}"
echo ""
echo "const [data] = await pool.query("
echo "  'SELECT * FROM table WHERE organization_id = ?',"
echo "  [organizationId]"
echo ");"