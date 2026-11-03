"use client";

import React from "react";
import { formatArs } from "../config/pricing";
import { useSiteConfig } from "../state/SiteConfig";

type Faq = { id: string; q: string; a: React.ReactNode };
type Group = { title: string; items: Faq[] };

/** Preguntas frecuentes. Los precios y límites salen de la configuración del sitio, así que siguen lo que edita el admin. */
export function FaqPage() {
  const { config } = useSiteConfig();
  const p = config.pricing;

  const groups: Group[] = [
    {
      title: "Precios y pago",
      items: [
        {
          id: "precio",
          q: "¿Cuánto cuesta una invitación?",
          a: (
            <>
              <p>
                Probar es gratis: armás tu invitación y ves la vista previa con
                marca de agua sin pagar ni registrarte.
              </p>
              <div>
                Para descargar la versión final sin marca de agua:
                <ul>
                  <li>
                    <strong>Video MP4</strong>: {formatArs(p.price)}.
                  </li>
                  <li>
                    <strong>Imagen vertical 1080x1920</strong>:{" "}
                    {formatArs(p.imagePrice)}.
                  </li>
                  <li>
                    <strong>Combo video + imagen</strong>:{" "}
                    {formatArs(p.bundlePrice)}.
                  </li>
                </ul>
                Es un único pago por invitación, sin suscripción.
              </div>
            </>
          ),
        },
        {
          id: "pago",
          q: "¿Cómo puedo pagar?",
          a: (
            <p>
              Con Mercado Pago: tarjeta de crédito o débito, dinero en cuenta y
              los demás medios que ofrezca en el momento. El pago es seguro y no
              vemos los datos de tu tarjeta.
            </p>
          ),
        },
        {
          id: "acreditacion",
          q: "¿Cuánto tarda en acreditarse el pago?",
          a: (
            <>
              <p>
                Los pagos con tarjeta o dinero en cuenta se acreditan en el
                momento. Al terminar, Mercado Pago te devuelve a AltaParty y ya
                podés generar tu video.
              </p>
              <p>
                Si pagaste con un medio en efectivo, puede demorar hasta que el
                comercio informe el pago. Cuando Mercado Pago te avise que se
                acreditó, volvé y tocá <em>Verificar mi pago</em>.
              </p>
            </>
          ),
        },
        {
          id: "pague-no-veo",
          q: "Pagué pero no puedo descargar mi video",
          a: (
            <>
              <p>
                El video no se envía por mail: se genera y se descarga desde la
                página. Volvé a AltaParty desde el mismo dispositivo y tocá{" "}
                <em>Verificar mi pago</em>.
              </p>
              <p>
                Si cerraste la página, abrí{" "}
                <em>¿Ya compraste tu video? Recuperalo con tu código</em> y pegá
                tu código de compra. Guardalo: lo ves en pantalla después de
                pagar.
              </p>
            </>
          ),
        },
      ],
    },
    {
      title: "Tu invitación",
      items: [
        {
          id: "corregir",
          q: "¿Puedo corregir mi invitación después de comprar?",
          a: (
            <p>
              Sí. Con tu compra podés generar el video hasta{" "}
              <strong>{p.maxFinalRenders} veces</strong>, por ejemplo para
              corregir un error de tipeo en el nombre, el lugar o el horario.
              Volvé con tu código de compra, cambiá lo que necesites y generalo
              de nuevo.
            </p>
          ),
        },
        {
          id: "plazo",
          q: "¿Hasta cuándo puedo volver a descargarla?",
          a: (
            <p>
              Conservamos los datos de tu compra durante{" "}
              <strong>{p.retentionDays} días</strong>. En ese plazo podés volver
              con tu código a descargar o corregir tu invitación; después se
              eliminan automáticamente.
            </p>
          ),
        },
        {
          id: "musica",
          q: "¿Puedo cambiar la música?",
          a: (
            <p>
              Sí. Cada plantilla trae una canción original, y podés elegir otra
              de la biblioteca o subir la tuya antes de generar la vista previa.
            </p>
          ),
        },
        {
          id: "cambiar-diseno",
          q: "¿Puedo cambiar de diseño sin volver a cargar los datos?",
          a: (
            <p>
              Sí. Cargás los datos de la fiesta una sola vez y los ves en todas
              las plantillas.
            </p>
          ),
        },
        {
          id: "formato",
          q: "¿En qué formato recibo la invitación?",
          a: (
            <p>
              El video es un MP4 vertical, pensado para compartir por WhatsApp,
              estados o por historias de Instagram. La imagen es un archivo
              vertical de 1080x1920 (PNG y JPG) con el estilo del diseño.
            </p>
          ),
        },
      ],
    },
    {
      title: "Descarga y problemas técnicos",
      items: [
        {
          id: "descarga-android",
          q: "¿Cómo descargo mi video en Android?",
          a: (
            <p>
              Tocá <em>Descargar</em> y el video se guarda en tu teléfono,
              normalmente en la carpeta Descargas y en la Galería.
            </p>
          ),
        },
        {
          id: "descarga-ios",
          q: "¿Cómo descargo mi video en iPhone?",
          a: (
            <p>
              Generalmente queda en la app <em>Archivos</em>, dentro de
              Descargas (o en iCloud Drive si lo tenés configurado). Desde ahí
              podés guardarlo en Fotos o compartirlo.
            </p>
          ),
        },
        {
          id: "foto",
          q: "¿Por qué no puedo subir una foto?",
          a: (
            <>
              <p>
                Algunos teléfonos no tienen memoria suficiente para cargar fotos
                muy grandes en el navegador. Probá recortarla o achicarla desde
                la galería antes de subirla.
              </p>
              <p>Si el problema sigue, usá una computadora.</p>
            </>
          ),
        },
        {
          id: "lento",
          q: "¿Por qué tarda en generarse el video?",
          a: (
            <p>
              El video se genera en tu propio dispositivo, no en nuestros
              servidores. Según tu celular o computadora puede tardar un rato.
              Dejá la pantalla encendida y no cierres la pestaña hasta que
              termine.
            </p>
          ),
        },
      ],
    },
    {
      title: "Privacidad",
      items: [
        {
          id: "fotos",
          q: "¿Qué pasa con mi foto y mis datos?",
          a: (
            <p>
              Tu foto y tu música se procesan en tu navegador y no salen de tu
              dispositivo mientras armás y probás la invitación. Solo guardamos
              lo necesario para tu compra y lo eliminamos a los{" "}
              {p.retentionDays} días.
            </p>
          ),
        },
      ],
    },
  ];

  return (
    <>
      <header className="app-header">
        <a className="brand" href="/" aria-label="Ir al inicio">
          <span className="brand-mark" aria-hidden="true">
            🎉
          </span>
          AltaParty
        </a>
        <a className="btn btn-secondary btn-sm" href="/">
          Crear mi invitación
        </a>
      </header>

      <main>
        <div className="home-intro">
          <p className="eyebrow">Ayuda</p>
          <h1>
            Preguntas <em>frecuentes</em>
          </h1>
          <p className="lead">
            Todo lo que necesitás saber para crear, pagar y descargar tu
            invitación de cumpleaños en video.
          </p>
        </div>

        <nav className="faq-index" aria-label="Índice de preguntas">
          {groups.map((g) => (
            <a key={g.title} href={`#${g.items[0].id}`}>
              {g.title}
            </a>
          ))}
        </nav>

        {groups.map((g) => (
          <section key={g.title} className="faq-group" aria-label={g.title}>
            <h2>{g.title}</h2>
            {g.items.map((f) => (
              <details key={f.id} id={f.id} className="panel faq-item">
                <summary>{f.q}</summary>
                <div className="faq-answer">{f.a}</div>
              </details>
            ))}
          </section>
        ))}

        <section className="panel faq-cta">
          <h2>¿Listo para empezar?</h2>
          <p className="hint">
            Armá tu invitación en un par de minutos. Ver la vista previa no
            cuesta nada.
          </p>
          <a className="btn btn-primary" href="/">
            Crear mi invitación
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          Las plantillas son diseños originales inspirados en temáticas
          populares; no son productos oficiales ni están afiliadas a ninguna
          marca.
        </p>
      </footer>
    </>
  );
}
