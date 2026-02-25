# Declaración de Seguridad y Arquitectura SGA Eventos
**Cumplimiento del Esquema Nacional de Seguridad (ENS - RD 311/2022)**

## 1. Visión General
El SGA Eventos (Palessito) es una aplicación de gestión de inventario de almacén desplegada para el control de material deportivo, didáctico y logístico. Este documento detalla la arquitectura de seguridad y los controles establecidos para alinearse con los lineamientos del **Esquema Nacional de Seguridad (ENS)** aplicable a la Administración Pública.

## 2. Categorización del Sistema
Acordi a las 5 dimensiones de seguridad de la información:
* **Disponibilidad:** Media (Sistema desplegado en arquitecturas serverless de alta disponibilidad).
* **Integridad:** Media (Trazabilidad de operaciones en BD).
* **Confidencialidad:** Básica (Datos no clasificados, accesibles únicamente a personal autorizado de gestión).
* **Autenticidad:** Media (Protección mediante OAuth 2.0 y Tokens JWT).
* **Trazabilidad:** Media (Registro individual de acciones por usuario).

Se establece una propuesta de **Nivel Básico-Medio** para la auditoría y operación del sistema en producción.

## 3. Arquitectura Tecnológica Resiliente

El sistema de descompone en tres capas totalmente serverless, heredando así las certificaciones Cloud de los proveedores subyacentes (Nivel Alto ENS del ENS Cloud):

1. **Frontend (Capa de Presentación):** 
   - SPA de React distribuida de forma inmutable mediante **GitHub Pages**. 
   - No almacena persistencia local más allá de cachés de UI (Progressive Web App). Las comunicaciones de salida usan forzosamente TLS 1.3 (HTTPS).
2. **Backend (Capa Lógica y NLP):**
   - API RESTful en Python/FastAPI.
   - Desplegado en **Google Cloud Run**, garantizando escalado automático, aislamiento de contenedores por petición y parches de infraestructura gestionados directamente por el proveedor (Google).
3. **Plano de Datos (Almacenamiento Continuo):**
   - Delegado en contenedores de **Google Workspace (Google Sheets)**, cifrados en reposo bajo AES-256. 
   - Aislado del acceso público y solo accesible mediante credenciales *Service Account* protegidas en el backend de Google Cloud.

## 4. Identidad y Control de Accesos (IAM)

* **Autenticación Delegada:** No se almacenan contraseñas endémicas en base de datos. Se utiliza delegación de identidad (**Google OAuth 2.0**).
* **Autorización por Lista Blanca (RBAC):** Una vez superado el control de Google, el Backend valida al usuario contra una matriz estricta (`USUARIOS`) alojada de forma remota, denegando el acceso si el correo corporativo ha sido desactivado o revocado por el administrador.
* **Control de Sesiones (JWT):** Generación de JSON Web Tokens (JWT) mediante criptografía `HS256`. 
  * Se implementa un recambio (TTL) estricto de **8 horas**, mitigando sesiones en reposo dejadas en terminales abiertos por trabajadores al marchar a casa.
* **Política CORS:** El flujo Backend impide la interceptación de *Cross-Site Scripting* al restingir programáticamente la entrada HTTP solo desde orígenes declarados por la Junta/Proyecto (ej., `.github.io`).

## 5. Trazabilidad y Logs

La política del SGA de Eventos garantiza que toda operación de inserción, salida o manipulación de elementos del inventario quede indexada en la capa de persistencia (Pestaña `LOGS`).
Esta traza incorpora:
- Timestamp validado por el servidor.
- Correo / Identidad del autor.
- Categoría de la Acción y Motivo o ID_Ubicación modificada.

## 6. Integraciones Críticas
Las peticiones al Asistente Inteligente (Palessito) y el motor de lógica difusa de Natural Language Processing (spaCy) se procesan estrictamente _in-house_ en el contenedor Cloud Run, sin enviar cadenas de texto a APIs externas sin certificar (ej. un LLM externo descontrolado), asegurando que el rastro del inventario no padece de exfiltración.

## 7. Alineación con la Política de Seguridad TIC de la Junta de Andalucía
El despliegue de SGA Eventos contempla las normativas específicas de la comunidad autónoma, en particular el **Decreto 1/2011** (Política de Seguridad TIC de la Administración de la Junta de Andalucía) y sus actualizaciones (ej. **Decreto 171/2020** y directrices de la Agencia Digital Andaluza - ADA).

La arquitectura mitiga los riesgos marcados por la Política TIC andaluza de la siguiente manera:
1. **Alojamiento en Entornos Cloud Homologados:** La Política de Seguridad TIC andaluza exige cautela en arquitecturas en la nube. Al reposar el Backend y Datos sobre la infraestructura de Google Workspace/Cloud (cuyos centros de datos europeos disponen de certificación ENS de Nivel Alto acreditada por el Centro Criptológico Nacional), el aplicativo hereda el manto de cumplimiento requerido por la ADA para externalización de infraestructura.
2. **Identidad Corporativa Única:** Cumpliendo la directriz de centralización de identidades de la Junta, el sistema SGA rechaza crear claves propias y se apoya en el correo corporativo (SSO mediante Google OAuth), evitando silos de contraseñas vulnerables en el ámbito educativo/institucional.
3. **Roles y Segregación de Funciones:** 
   - El perfil `ADMIN` se reserva para el personal responsable del Sistema de Información (Responsable de Seguridad).
   - Los perfiles de trabajadores regulares quedan limitados en permisos (principio de mínimo privilegio).
4. **Protección de Datos (RGPD y LOPDGDD):** SGA Eventos no gestiona, almacena, ni procesa Datos Personales (Categoría Especial ni Básica), puesto que su núcleo de datos versa exclusivamente sobre *Material Logístico* inanimado. La única traza personal son los correos electrónicos corporativos usados como *Identificadores de Auditoría* (uso legítimo profesional), lo que rebaja las exigencias de Evaluación de Impacto (EIPD).
