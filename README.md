# Plataforma de Farmacología Gamificada

Plataforma web de estudio de farmacología para estudiantes de enfermería, atención prehospitalaria y carreras afines. Funciona por suscripción paga. El contenido es texto organizado en un pensum por familias de fármacos (**Tema → Subtema → Lección**). Cada lección termina con desafíos, y el estudiante gana **XP** para el ranking y **gemas** para personalizar su skin. Al completar un tema presenta un examen general y, si lo aprueba, recibe un diploma.

## Tecnologías

| Área | Tecnología | Decisión |
|---|---|---|
| Lenguaje | TypeScript (modo estricto) sobre Node.js | ADR-0001, ADR-0015 |
| Arquitectura | Monolito modular con Bounded Contexts | ADR-0002, ADR-0004, ADR-0006 |
| Framework HTTP | Express 5 | ADR-0011 |
| Base de datos | MySQL | Requisitos |
| ORM | Prisma 7 + adaptador MariaDB | ADR-0007, ADR-0014 |
| Autenticación | JWT sin estado + bcrypt | ADR-0008 |
| Validación | Zod | ADR-0009, ADR-0012 |
| Pruebas | `node:test` + `tsx` | ADR-0013 |

## Estructura

```
src/
├── app.ts                    # Punto de entrada: middlewares, rutas y servidor
├── compartido/               # Lo único que todos los módulos pueden usar
│   ├── config/               # Variables de entorno validadas y cliente Prisma
│   ├── errores/              # Jerarquía de errores de aplicación
│   ├── eventos/              # Bus de eventos interno tipado
│   ├── middlewares/          # Manejador de errores, sesión y roles
│   ├── tipos/                # Contratos de eventos entre módulos
│   └── validacion/           # Validación con Zod
├── modulos/
│   └── autenticacion/
│       ├── dominio/          # Modelo y puertos (interfaces)
│       ├── aplicacion/       # Casos de uso y esquemas Zod
│       ├── infraestructura/  # Prisma, bcrypt, JWT
│       └── fachada.ts        # Único punto de entrada público del módulo
├── rutas/                    # Rutas HTTP delgadas → fachadas
└── generado/                 # Cliente Prisma generado (no se sube a Git)
prisma/schema.prisma          # Esquema de base de datos
tests/                        # Pruebas por módulo
docs/                         # ADRs, requisitos y glosario
```

Regla principal: un módulo **solo** puede usar la `fachada.ts` de otro módulo o comunicarse por eventos. Nunca toca sus tablas ni sus clases internas (ADR-0004).

## Cómo ejecutarlo

Requisitos: Node.js y un servidor MySQL.

1. Instalar las dependencias:
   ```bash
   npm install
   ```
2. Copiar `.env.example` como `.env` y completar los datos de MySQL y el secreto JWT.
3. Generar el cliente Prisma y crear las tablas:
   ```bash
   npm run prisma:generar
   npm run prisma:migrar
   ```
4. Arrancar en modo desarrollo (se reinicia solo al guardar cambios):
   ```bash
   npm run desarrollo
   ```

| Script | Qué hace |
|---|---|
| `npm run desarrollo` | Servidor en modo desarrollo con recarga automática |
| `npm test` | Ejecuta las pruebas (no necesitan MySQL) |
| `npm run verificar` | Revisa los tipos de TypeScript sin compilar |
| `npm run compilar` | Compila a `dist/` |
| `npm run iniciar` | Ejecuta la versión compilada |
| `npm run prisma:generar` | Genera el cliente Prisma |
| `npm run prisma:migrar` | Crea o actualiza las tablas en MySQL y regenera el cliente |
| `npm run asignar-rol -- <correo> <rol>` | Asigna un rol desde la consola (sirve para crear el primer Administrador) |

### Crear el primer Administrador

El registro público siempre crea Estudiantes. Para tener el primer Administrador, regístrate normalmente y luego, en la consola del servidor:

```bash
npm run asignar-rol -- tu-correo@ejemplo.com administrador
```

A partir de ahí, ese Administrador asigna los demás roles desde la API. El rol nuevo aplica desde el siguiente inicio de sesión.

## API disponible

| Método y ruta | Descripción |
|---|---|
| `GET /api/salud` | Comprueba que el servidor está activo |
| `POST /api/autenticacion/registro` | Registra un Estudiante (`{ email, contrasena }`) |
| `POST /api/autenticacion/inicio-sesion` | Devuelve `{ token, usuario }` |
| `GET /api/autenticacion/yo` | Usuario actual (cabecera `Authorization: Bearer <token>`) |
| `POST /api/autenticacion/recuperacion/solicitar` | Envía un enlace para restablecer la contraseña (`{ email }`) |
| `POST /api/autenticacion/recuperacion/restablecer` | Cambia la contraseña con el token del enlace (`{ token, contrasenaNueva }`) |
| `PATCH /api/autenticacion/usuarios/:usuarioId/rol` | Asigna un rol (`{ rol }`). Solo Administrador |

En desarrollo, los correos no se envían: se muestran en la consola del servidor. El proveedor de correo real está pendiente de elegir.

Todos los errores responden con el mismo formato: `{ "error": { "codigo", "mensaje", "detalles?" } }`.

## Estado

- [x] Base compartida (configuración, errores, eventos, validación, middlewares)
- [x] Autenticación: registro, inicio de sesión, verificación de JWT
- [x] Autenticación: recuperación de contraseña y asignación de roles
- [ ] Envío real de correos (proveedor pendiente de elegir)
- [ ] Suscripciones y pagos
- [ ] Contenido / Pensum
- [ ] Desafíos
- [ ] Gamificación
- [ ] Administración

## Documentación

- `docs/adr/`: decisiones de arquitectura (ADR-0001 a ADR-0015)
- `docs/requisitos/`: documento de requisitos (versión vigente: v3)
- `docs/glosario/`: glosario de lenguaje ubicuo (versión vigente: v3)
