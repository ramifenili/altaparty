import type { Metadata } from "next";
import { Mascot } from "../../src/components/landing/Mascots";
import { Banner } from "../../src/components/landing/Banner";
import { PartyPopper } from "lucide-react";
import { Icon } from "../../src/components/Icon";

export const metadata: Metadata = {
  title: "Invitaciones de cumpleaños en video — AltaParty",
  description:
    "Elegí un diseño, cargá tu foto y los datos de la fiesta y descargá un video MP4 animado listo para WhatsApp. Probalo gratis antes de comprar.",
  alternates: { canonical: "/landing" },
};

const FEATURES = [
  {
    icon: "palette",
    title: "Diseños con personalidad",
    text: "Plantillas infantiles, juveniles y elegantes, todas animadas.",
  },
  {
    icon: "camera",
    title: "Tu foto, tus datos",
    text: "Nombre, edad, lugar y horario aparecen en la animación.",
  },
  {
    icon: "smartphone",
    title: "Listo para WhatsApp",
    text: "Un video MP4 vertical que se ve bien en cualquier celular.",
  },
];

const STACK = [
  {
    kicker: "Paso 1",
    title: "Elegí el diseño que más le queda al cumpleañero",
    text: "Mirá cada plantilla con tus propios datos antes de decidir. Si cambiás de idea, cambiás de diseño sin volver a cargar nada.",
    bg: "yellow",
    mascots: ["star", "square"] as const,
  },
  {
    kicker: "Paso 2",
    title: "Sumá la foto, la música y los datos de la fiesta",
    text: "Elegí la canción, escribí el lugar y el horario y revisá la vista previa en vivo. Todo pasa en tu navegador: tu foto no sale de tu dispositivo hasta que comprás.",
    bg: "white",
    mascots: ["circle", "triangle"] as const,
  },
  {
    kicker: "Paso 3",
    title: "Descargá el video y mandalo por WhatsApp",
    text: "La vista previa con marca de agua es gratis. Si te gusta, comprás y descargás el video MP4 final, y podés rehacerlo si te equivocaste en un dato.",
    bg: "yellow",
    mascots: ["blob", "star"] as const,
  },
];

export default function Landing() {
  return (
    <div className="lf">
      <header className="lf-nav">
        <a className="lf-logo" href="/landing">
          <span className="lf-logo-mark" aria-hidden="true">
            <PartyPopper size={18} />
          </span>
          AltaParty
        </a>
        <nav aria-label="Principal">
          <a href="#como-funciona">Cómo funciona</a>
          {/* <a href="/gratis">Conseguilo gratis</a> */}
        </nav>
        <a className="lf-btn lf-btn-sm" href="/">
          Crear invitación
        </a>
      </header>

      <Banner>
        Probá tu invitación gratis: la vista previa no cuesta nada.
      </Banner>

      <section className="lf-hero">
        <div>
          <h1>Los cumpleaños se invitan con movimiento</h1>
          <p className="lf-lead">
            Creá una invitación animada con tu foto, la música que quieras y los
            datos de la fiesta. Descargala en video MP4 y mandala por WhatsApp.
          </p>
          <a className="lf-btn" href="/">
            Empezar gratis
          </a>
        </div>
        <div className="lf-cast" aria-hidden="true">
          <Mascot kind="star" className="m1" />
          <Mascot kind="circle" className="m2" />
          <Mascot kind="triangle" className="m3" />
          <Mascot kind="square" className="m4" />
        </div>
      </section>

      <section className="lf-trio" aria-label="Qué incluye">
        {FEATURES.map((f) => (
          <article key={f.title}>
            <span className="lf-ico" aria-hidden="true">
              <Icon name={f.icon} size={26} />
            </span>
            <h2>{f.title}</h2>
            <p>{f.text}</p>
          </article>
        ))}
      </section>

      <div id="como-funciona">
        {STACK.map((s, i) => (
          <section
            key={s.kicker}
            className={`lf-feature lf-${s.bg}${i % 2 ? " lf-flip" : ""}`}
          >
            <div className="lf-copy">
              <p className="lf-kicker">{s.kicker}</p>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
            </div>
            <div className="lf-art" aria-hidden="true">
              {s.mascots.map((k, j) => (
                <Mascot key={j} kind={k} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="lf-cta">
        <h2>Armá tu invitación en 2 minutos</h2>
        <p>Sin registrarte y sin pagar para ver cómo queda.</p>
        <a className="lf-btn" href="/">
          Ver mi invitación
        </a>
      </section>

      <footer className="lf-foot">
        <p>
          Las plantillas son diseños originales inspirados en temáticas
          populares; no son productos oficiales ni están afiliadas a ninguna
          marca.
        </p>
      </footer>
    </div>
  );
}
