# 📊 Panel de Costos Resiter — Instructivo

---

## ▶️ Para VER el panel

Doble clic en **`Panel Costos Resiter.html`**. Se abre en el navegador y **pide una contraseña**.
Para compartirlo, sube ese archivo a SharePoint (o envíalo) y pasa la contraseña por separado.

---

## 🔒 Contraseña

El panel **viene cifrado**: los datos están encriptados dentro del archivo y **sin la contraseña no se ven**
(no alcanza con "ver código fuente"). La contraseña se define en **`motor/clave.txt`**.

- **Cambiar la contraseña:** abre `motor/clave.txt`, escribe la nueva, guarda, y corre **`Actualizar panel.command`**.
  El panel se regenera cifrado con la clave nueva.
- **Importante:** quien tenga la contraseña puede ver los datos. Elige una robusta y compártela por un canal aparte.
- Cualquiera que tenga acceso a esta carpeta puede leer `motor/clave.txt`. Si quieres que la contraseña sea
  un secreto real frente a quienes ven la carpeta, guarda la carpeta `motor` en un lugar restringido
  (o no la compartas) y distribuye solo el `.html`.
- El cifrado necesita que el navegador abra el archivo de forma segura (desde SharePoint, o doble clic local).
  Funciona en Chrome, Edge, Firefox y Safari.

> Contraseña por defecto al crearse: **`Resiter.Costos.2026`** — cámbiala cuanto antes.

---

## 🔄 Para ACTUALIZAR los datos

El panel se alimenta de los archivos que están dentro de la carpeta **`Fuentes`**.
Actualizar son **3 pasos**. Siempre los mismos.

```
┌─────────────────────────────────────────────────────────────┐
│  PASO 1   Consigue el archivo nuevo (OC o IG).               │
│  PASO 2   Pégalo en la carpeta "Fuentes", reemplazando al    │
│           anterior y MANTENIENDO EL MISMO NOMBRE.            │
│  PASO 3   Doble clic en "Actualizar panel.command".          │
│           Espera 1–2 min. Listo: abre el panel de nuevo.    │
└─────────────────────────────────────────────────────────────┘
```
 
### 🟦 Actualizar la OC (compras de SAP) — se va AGREGANDO, no se recarga

La OC vive en la subcarpeta **`Fuentes/OC/`**. La idea es **ir sumando un archivo por mes**, sin
volver a cargar el histórico.

1. Exporta de SAP las OCs del **mes en curso** (te conviene exportar "del 1° del mes hasta hoy").
2. **Pega ese Excel dentro de `Fuentes/OC/`** (cualquier nombre sirve; ideal: `OC 2026-07.xlsx`).
3. **No borres los archivos de los meses anteriores** — quedan ahí y el panel los usa.
4. Doble clic en **`Actualizar panel.command`**.

> **Puedes re-exportar el mismo mes las veces que quieras.** Si vuelves a pegar el export del mes en
> curso (ya más avanzado), el motor reconoce las líneas repetidas por su Nº de OC y **se queda con la
> versión más nueva — nunca duplica**. Cuando cierre el mes, exporta el mes completo una última vez
> y, al mes siguiente, empiezas un archivo nuevo.

### 🟩 Actualizar el IG (Informe de Gestión)

1. Consigue el IG nuevo (sale el 15–20 de cada mes, con el mes anterior cerrado).
2. Guárdalo/renómbralo como **`IG.xlsm`** (tiene que ser `.xlsm`, el de macros).
3. Pégalo en la carpeta **`Fuentes`**, reemplazando el `IG.xlsm` anterior.
4. Doble clic en **`Actualizar panel.command`**.

### 🟧 Actualizar la Proyección de cierre

1. Consigue el archivo de proyección nuevo (la planilla de cierre del comité).
2. Guárdalo/renómbralo como **`Proyeccion.xlsx`** (debe tener la hoja `Resumen Costos x Mes`).
3. Pégalo en **`Fuentes`**, reemplazando el `Proyeccion.xlsx` anterior.
4. Doble clic en **`Actualizar panel.command`**.

> Alimenta las columnas **Proy. a la fecha** y **Proy. fin de mes**. Se toma el total de costo del
> mes por contrato y se reparte por partida con el mismo criterio que el presupuesto (mix real).

> Puedes actualizar varios a la vez: reemplaza los archivos que cambiaron y corre el actualizador una sola vez.

---

## ✅ Reglas que NO se pueden saltar

| Archivo | Dónde va | Formato |
|---|---|---|
| Compras SAP | dentro de **`Fuentes/OC/`** (un archivo por mes, se acumulan) | `.xlsx` |
| Informe de Gestión | **`Fuentes/IG.xlsm`** (un solo archivo, se reemplaza) | `.xlsm` (con macros) |
| Proyección de cierre | **`Fuentes/Proyeccion.xlsx`** (se reemplaza) | `.xlsx` (hoja `Resumen Costos x Mes`) |
| Presupuesto | `Fuentes/Presupuesto.xlsx` (casi no cambia) | `.xlsx` |
| Plan de cuentas | `Fuentes/Plan de cuentas.xlsx` (casi no cambia) | `.xlsx` |

- La **OC se ACUMULA** dentro de `Fuentes/OC/`: agregas un archivo por mes y no borras los anteriores.
- El **IG se REEMPLAZA**: es acumulativo por diseño (trae todos los meses adentro), así que el nuevo
  pisa al anterior. Mantén su nombre `IG.xlsm` y que sea `.xlsm` (si lo guardas como `.xlsx` no funciona).
- **No cambies** los nombres de `IG.xlsm`, `Presupuesto.xlsx` ni `Plan de cuentas.xlsx`.
- **No muevas** la carpeta `motor` ni la carpeta `Fuentes`: el actualizador las necesita al lado.

---

## 🧠 Lo que el panel hace solo (no tienes que tocar nada)

- **La fecha de corte se detecta sola** = la última fecha de las OCs cargadas. Si subes OCs
  hasta el 20 de julio, el panel se corre solo a esa fecha.
- **Une todos los archivos de OC** de `Fuentes/OC/` sin duplicar (reconoce las líneas por su Nº de OC).
- **Las remuneraciones y la depreciación** se toman del IG, y **solo aparecen en los meses
  cerrados**. El mes en curso va solo con OC (porque el IG de ese mes todavía no existe).
- El **selector de Período** (arriba a la izquierda) permite mirar cualquier mes histórico.

---

## 🆘 Si algo falla

- **"No encuentro el archivo de OC/IG…"** → la OC va dentro de `Fuentes/OC/` (al menos un `.xlsx`);
  el IG va como `Fuentes/IG.xlsm`.
- **"No está instalado Python 3"** → instálalo desde python.org y vuelve a hacer doble clic.
- **El número de un mes se ve raro** → puede ser un mapeo pendiente (faena sin zona o concepto
  sin partida). Eso aparece marcado como **"(Revisar)"** en el panel; avisa para ajustarlo.
- Si Mac dice que no puede abrir el `.command` por seguridad: clic derecho sobre el archivo →
  **Abrir** → **Abrir** (solo la primera vez).

---

*Versión HTML con actualización manual. Próximas etapas previstas: conexión automática a SAP por API y, finalmente, Power BI.*
