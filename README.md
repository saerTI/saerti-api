# ConstructFlow - Sistema de Gestión de Proyectos de Construcción

ConstructFlow es una plataforma de gestión especializada para proyectos de construcción que permite realizar seguimiento financiero detallado, monitorear flujos de caja y visualizar estados financieros de manera intuitiva.

## Características

- **Gestión de Proyectos**: Creación, seguimiento y administración de proyectos de construcción
- **Hitos de Proyecto**: Definición y seguimiento de hitos con fechas y montos asociados
- **Flujo de Caja**: Registro detallado de ingresos y gastos con categorización
- **Reportes Financieros**: Visualización de estados financieros y progreso de proyectos
- **Sistema de Usuarios**: Autenticación y autorización con diferentes niveles de acceso

## Requisitos

- Node.js (v14.x o superior)
- MySQL (v8.0 o superior)

## Instalación

1. Clonar el repositorio:
   ```
   git clone https://github.com/tu-usuario/constructflow.git
   cd constructflow
   ```

2. Instalar dependencias:
   ```
   npm install
   ```

3. Configurar variables de entorno:
   - Crear un archivo `.env` basado en el ejemplo proporcionado
   - Configurar las credenciales de la base de datos y demás parámetros

4. Configurar la base de datos:
   ```
   npm run setup
   ```
   Este comando creará las tablas necesarias y un usuario administrador inicial.

5. Iniciar el servidor:
   ```
   npm run dev   # Para ambiente de desarrollo
   npm start     # Para ambiente de producción
   ```

## Estructura del Proyecto

```
constructflow/
├── config/               # Configuración de la aplicación
├── controllers/          # Controladores de la API
├── middleware/           # Middleware personalizado
├── models/               # Modelos de datos
├── routes/               # Rutas de la API
├── scripts/              # Scripts de utilidad
├── utils/                # Funciones de utilidad
├── app.mjs               # Configuración de Express
├── server.mjs            # Punto de entrada de la aplicación
└── package.json          # Dependencias y scripts
```

## Documentación de la API

### Autenticación

- `POST /api/auth/register` - Registra un nuevo usuario
- `POST /api/auth/login` - Inicia sesión y devuelve tokens de autenticación
- `GET /api/auth/profile` - Obtiene el perfil del usuario actual
- `PUT /api/auth/profile` - Actualiza el perfil del usuario actual

### Proyectos

- `GET /api/projects` - Lista todos los proyectos
- `POST /api/projects` - Crea un nuevo proyecto
- `GET /api/projects/:id` - Obtiene un proyecto específico
- `PUT /api/projects/:id` - Actualiza un proyecto
- `DELETE /api/projects/:id` - Elimina un proyecto
- `PATCH /api/projects/:id/status` - Actualiza el estado de un proyecto

### Hitos

- `GET /api/projects/:projectId/milestones` - Lista los hitos de un proyecto
- `POST /api/projects/:projectId/milestones` - Crea un nuevo hito
- `PUT /api/milestones/:id` - Actualiza un hito
- `DELETE /api/milestones/:id` - Elimina un hito
- `PATCH /api/milestones/:id/complete` - Marca un hito como completado

### Flujo de Caja

- `GET /api/projects/:projectId/cash-flow` - Obtiene el flujo de caja de un proyecto
- `POST /api/projects/:projectId/incomes` - Registra un nuevo ingreso
- `POST /api/projects/:projectId/expenses` - Registra un nuevo gasto
- `GET /api/cash-flow/categories` - Lista las categorías de flujo de caja
- `POST /api/cash-flow/categories` - Crea una nueva categoría

### Reportes

- `GET /api/reports/monthly-cash-flow/:projectId` - Reporte de flujo de caja mensual
- `GET /api/reports/project-status` - Estado general de todos los proyectos
- `GET /api/reports/project-detail/:projectId` - Reporte detallado de un proyecto

## Credenciales por defecto

Después de ejecutar el script de configuración, se crea un usuario administrador con las siguientes credenciales:

- **Email**: admin@constructflow.com
- **Contraseña**: admin123

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo LICENSE para más detalles.