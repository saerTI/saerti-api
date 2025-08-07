# SAER TI - Backend

Sistema de gestión empresarial con seguimiento financiero, control de centros de costo y análisis multidimensional de datos empresariales.

## Descripción

SAER TI Backend es una API REST robusta construida con Node.js y Express que proporciona funcionalidades avanzadas de gestión empresarial incluyendo:

- **Gestión de Usuarios y Autenticación**: Sistema completo de usuarios con JWT
- **Centros de Costo**: Control y seguimiento de centros de costo empresariales
- **Análisis Multidimensional**: Navegación y análisis de costos con múltiples dimensiones
- **Reportes Financieros**: Generación de reportes detallados y consolidados
- **API RESTful**: Endpoints bien estructurados para integración con frontend

## Requisitos del Sistema

- **Node.js**: v18.x o superior (recomendado v20.x)
- **MySQL**: v8.0 o superior
- **npm**: v8.x o superior

## Instalación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/saerTI/saer-backend.git
cd saer-backend
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configuración de Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Configuración del servidor
PORT=3000
NODE_ENV=development

# Configuración de la base de datos
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=tu_contraseña_mysql
DB_NAME=saer_ti
DB_CONNECTION_LIMIT=10

# Configuración JWT
JWT_SECRET=tu_clave_secreta_jwt
JWT_EXPIRES_IN=1d
```

### 4. Configurar la Base de Datos

#### Opción A: Configuración Automática (Recomendado)

```bash
# Crear base de datos y tablas automáticamente
npm run setup
```

#### Opción B: Configuración Forzada (Elimina datos existentes)

```bash
# ⚠️ CUIDADO: Elimina toda la base de datos existente
npm run setup_db:force
```

### 5. Crear Usuario Administrador

```bash
# Crear usuario administrador inicial
node scripts/seedAdmin.mjs
```

Credenciales por defecto del administrador:
- **Email**: felipeslzar@gmail.com
- **Contraseña**: 1234

### 6. Iniciar el Servidor

```bash
# Modo desarrollo (con nodemon)
npm run dev

# Modo producción
npm start
```

El servidor estará disponible en: `http://localhost:3000`

## Estructura del Proyecto

```
saer-backend/
├── src/
│   ├── config/           # Configuración de BD y aplicación
│   ├── controllers/      # Controladores de la API
│   │   ├── CC/          # Controladores de Centros de Costo
│   │   └── ...
│   ├── middleware/       # Middleware personalizado
│   ├── models/          # Modelos de datos
│   ├── routes/          # Definición de rutas
│   │   ├── CC/         # Rutas de Centros de Costo
│   │   └── ...
│   └── utils/           # Utilidades y helpers
├── scripts/             # Scripts de configuración y mantenimiento
├── .env.example         # Ejemplo de variables de entorno
├── server.mjs           # Punto de entrada de la aplicación
└── package.json         # Dependencias y scripts
```

## API Endpoints

### Autenticación

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|---------|
| POST | `/api/auth/register` | Registrar nuevo usuario | Público |
| POST | `/api/auth/login` | Iniciar sesión | Público |
| POST | `/api/auth/logout` | Cerrar sesión | Privado |
| GET | `/api/auth/validate` | Validar token | Privado |
| GET | `/api/auth/profile` | Obtener perfil | Privado |
| PUT | `/api/auth/profile` | Actualizar perfil | Privado |

### Usuarios

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|---------|
| GET | `/api/users` | Listar usuarios | Admin |
| POST | `/api/users` | Crear usuario | Admin |
| GET | `/api/users/:id` | Obtener usuario | Admin |
| PUT | `/api/users/:id` | Actualizar usuario | Admin |
| DELETE | `/api/users/:id` | Eliminar usuario | Admin |
| PATCH | `/api/users/:id/status` | Cambiar estado | Admin |

### Centros de Costo

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|---------|
| GET | `/api/consolidada` | Vista consolidada | Privado |
| GET | `/api/consolidada/dashboard` | Dashboard ejecutivo | Privado |
| GET | `/api/consolidada/stats` | Estadísticas generales | Privado |
| GET | `/api/consolidada/resumen/estados` | Resumen por estado | Privado |

### Análisis Multidimensional

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|---------|
| GET | `/api/costs/explore` | Navegación multidimensional | Privado |
| GET | `/api/costs/dimensions` | Dimensiones disponibles | Privado |
| GET | `/api/costs/by-period` | Costos por período | Privado |
| GET | `/api/costs/health` | Estado del sistema | Privado |

### Reportes

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|---------|
| GET | `/api/reports/monthly-cash-flow/:projectId` | Flujo de caja mensual | Privado |
| GET | `/api/reports/project-status` | Estado de proyectos | Privado |
| GET | `/api/reports/project-detail/:projectId` | Detalle de proyecto | Privado |

## Scripts Disponibles

```bash
# Iniciar servidor en producción
npm start

# Iniciar servidor en desarrollo
npm run dev

# Configurar base de datos
npm run setup

# Configurar base de datos (forzado)
npm run setup_db:force

# Crear usuario administrador
node scripts/seedAdmin.mjs
```

## Configuración de Base de Datos

### Troubleshooting Común

**Error de autenticación MySQL:**
```sql
-- Cambiar método de autenticación
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'tu_contraseña';
FLUSH PRIVILEGES;
```

**Crear usuario específico para la aplicación:**
```sql
CREATE USER 'saer_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'tu_contraseña';
GRANT ALL PRIVILEGES ON saer_ti.* TO 'saer_user'@'localhost';
FLUSH PRIVILEGES;
```

## Seguridad

- **JWT Tokens**: Autenticación basada en tokens JWT
- **Bcrypt**: Encriptación de contraseñas con salt
- **Middleware de Autenticación**: Protección de rutas sensibles
- **Validación de Datos**: Validación robusta con express-validator
- **CORS**: Configuración de CORS para seguridad de frontend

## Logging y Debugging

El sistema incluye logging detallado para facilitar el debugging:

```bash
# Ver logs de conexión a BD
npm run dev

# Verificar estado del sistema multidimensional
curl http://localhost:3000/api/costs/health
```

## Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE.md](LICENSE.md) para más detalles.

## Soporte

Para reportar bugs o solicitar nuevas funcionalidades, por favor crear un issue en el repositorio de GitHub.

## Changelog

### v1.0.0
- Implementación inicial del sistema
- Sistema de autenticación JWT
- Gestión de usuarios y roles
- Centros de costo
- Análisis multidimensional
- API RESTful completa