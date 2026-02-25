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
