# 🚀 Gestión de Transferencias Cartera-El Libertador

Sistema web desarrollado para la gestión interna de interacciones entre asesores en Seguros Bolívar, enfocado en:

* 📞 Transferencia de llamadas (Mensajes)
* 🎁 Generación de links de pago (Regalos)
* 📊 Seguimiento, métricas y ranking de desempeño
* 🔔 Automatización de notificaciones por correo

---

## 🧠 Objetivo del Proyecto

Optimizar la colaboración entre asesores, mejorar el control de gestiones y generar métricas claras que permitan:

* Medir productividad
* Identificar generación de valor
* Evitar desatención de clientes
* Facilitar seguimiento interno
* Crear base para incentivos

---

## 🏗️ Arquitectura

### 🔹 Frontend

* React + Vite
* Tailwind CSS
* Componentes reutilizables (Cards, Dashboard, Tables)
* UI moderna tipo dashboard empresarial

### 🔹 Backend

* Firebase (BaaS)

  * 🔐 Authentication (Google)
  * 📦 Firestore (Base de datos en tiempo real)
  * ⚙️ Firebase Functions v2 (automatización)
  * 🔑 Secrets (credenciales seguras)

### 🔹 Integraciones

* Nodemailer (envío de correos SMTP)
* Gmail (correo corporativo)

---

## 🔐 Autenticación

* Login con Google

* Restricción por dominio corporativo:

  ```
  @segurosbolivar.com
  ```

* Roles manejados:

  * 👤 Asesor
  * 👨‍💼 Supervisor
  * 🛡️ Admin

---

## 📦 Estructura de Datos (Firestore)

Colección principal:

```
registros
```

Cada documento contiene:

```json
{
  "managementType": "Mensaje | Regalo",
  "fromAdvisorName": "",
  "fromAdvisorEmail": "",
  "toAdvisorName": "",
  "toAdvisorEmail": "",
  "supervisorEmail": "",
  "customerName": "",
  "requestNumber": "",
  "phone": "",
  "paymentValue": 0,
  "status": "Pendiente | Gestionado",
  "createdAt": "",
  "updatedAt": ""
}
```

---

## ⚙️ Funcionalidades Principales

### 📌 Registro de gestiones

* Transferencias de llamadas
* Generación de links de pago

### 📊 Dashboard

* Métricas en tiempo real
* Estadísticas por asesor
* Visualización por rol

### 🏆 Ranking

* Top asesores que generan valor
* Clasificación por links de pago

### 📋 Seguimiento

* Estados: Pendiente / Gestionado
* Historial de interacciones

### 🔍 Búsqueda

* Búsqueda global por cliente o solicitud

### 🔔 Notificaciones

* Alertas internas dentro del sistema
* Correos automáticos

---

## 📧 Automatización de Correos

Implementado con Firebase Functions.

### 🔹 Mensaje (Transferencia)

Se envía a:

* Asesor receptor
* Supervisor (CC)

Incluye:

* Cliente
* Solicitud
* Teléfono
* Prioridad de gestión

---

### 🔹 Regalo (Link de pago)

Se envía a:

* Supervisor

Incluye:

* Cliente
* Solicitud
* Teléfono
* Valor generado

📊 Este tipo suma al ranking de desempeño.

---

## 🎨 Diseño UI

Paleta corporativa:

* 🔴 Rojo: `#a1161bff`
* 🔵 Azul oscuro: `#153157`
* ⚪ Gris claro: `#d9d9d9ff`

Características:

* Dashboard moderno
* Cards con sombras
* Bordes redondeados
* Experiencia tipo CRM empresarial

---

## 🔑 Variables de Entorno

Frontend (.env):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_ID=(default)
```

---

Backend (Firebase Secrets):

```
EMAIL_USER
EMAIL_PASS
```

---

## 🚀 Despliegue

### 🔹 Frontend

* Desplegado en entorno web (Vite / hosting integrado)

### 🔹 Backend

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

---

## 🧪 Estado del Proyecto

✅ Autenticación funcional
✅ Base de datos conectada
✅ Registro de gestiones
✅ Dashboard operativo
✅ Correos automáticos activos
✅ Roles implementados

---

---

## 👨‍💻 Uso Interno

Este sistema es de uso exclusivo para:

**Asesores y supervisores de Seguros Bolívar**

---

## ⚠️ Nota

Este CRM fue diseñado como solución interna para mejorar procesos operativos y no está destinado para uso público.

---

## 💼 Autor
*@talianamoreno08@gmail.com
*Desarrollado como solución interna de automatización y gestión CRM.

---
