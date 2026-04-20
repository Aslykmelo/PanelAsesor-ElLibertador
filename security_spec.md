# Especificación de Seguridad - El Libertador

## Invariantes de Datos
1. Un usuario solo puede acceder a sus propios datos de perfil a menos que sea administrador.
2. Un asesor solo puede ver gestiones donde sea el remitente o el destinatario.
3. Los administradores y supervisores pueden ver todas las gestiones globales.
4. Los registros (`registros`) son inmutables en ciertos campos clave tras su creación (ej: cliente, ID de solicitud).
5. Los correos electrónicos deben ser tratados de forma insensible a mayúsculas/minúsculas.

## Los "Docena Sucia" (Payloads de Ataque)
1. **Suplantación de Identidad:** Intentar crear un registro con `fromAdvisorEmail` de otro usuario.
2. **Lectura Indiscreta:** Un asesor intentando leer un registro donde no participa.
3. **Escalada de Privilegios:** Intentar actualizar su propio documento en `users` para cambiarse el rol a `admin`.
4. **Borrado Masivo:** Un asesor intentando borrar registros (solo admins pueden).
5. **Inyección de ID:** Intentar crear un documento con un ID de 1MB de caracteres basura.
6. **Falsificación de Fecha:** Intentar poner una fecha de `createdAt` manual en el futuro.
7. **Modificación de Estado Prohibida:** Intentar cambiar un registro ya `gestionado` de vuelta a `pendiente`.
8. **Acceso a Logs:** Un asesor intentando leer la colección `login_logs`.
9. **Creación de Admin:** Intentar crear un documento en la colección `admins` (ficticia o real).
10. **Lectura de Usuarios:** Un asesor intentando listar todos los documentos de la colección `users`.
11. **Bypass de Supervisor:** Un asesor intentando ver datos de todos los asesores bajo un supervisor específico sin permiso.
12. **Actualización de Cartera:** Un asesor intentando cambiarse la cartera asignada en su perfil.

## Plan de Remediación (Reglas de Producción)
Implementaremos las 8 columnas de seguridad:
1. **Master Gate:** Relación jerárquica clara.
2. **Blueprints de Validación:** Funciones `isValidUser` y `isValidRegistro`.
3. **Hardening de Rutas:** Validación de IDs de documentos.
4. **Identidad por Niveles:** Diferencia clara entre Admin, Supervisor y Asesor.
5. **Array Guarding:** No aplica mucho aquí, pero vigilaremos listas.
6. **Aislamiento de PII:** El correo es la clave, se protege el acceso.
7. **Atomicidad:** No hay escrituras cruzadas complejas por ahora.
8. **Consultas Seguras:** Reglas de `list` que obligan a filtrar por rol.
