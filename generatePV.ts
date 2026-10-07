/**
 * Génération du procès-verbal au format Microsoft Word (.docx) avec la bibliothèque `docx`.
 *
 * Mise en page :
 *  - A4, marges standard 2,5 cm, police institutionnelle (Cambria par défaut) ;
 *  - En-tête officiel COSUMA-RDC sur la 1re page (logo + nom + service + adresse + filet) ;
 *    en-tête réduit sur les pages suivantes ; pied de page « Page X / Y » ;
 *  - Titres de niveau 1 (visibles dans le volet de navigation de Word) ;
 *  - Tableaux : informations générales, participants, décisions/résolutions, plan d'action ;
 *  - Bloc de signatures (secrétaire / président).
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
  type ParagraphChild,
} from "docx";
import { DOC_TYPE_LABELS, DocType, MeetingInfo, OrgSettings, PVContent } from "../types";
import { fitBox, loadLogo, type LogoImage } from "./logo";

/* ------------------------------ Charte graphique ------------------------------ */

const NAVY = "1F3864";
const GOLD = "B8860B";
const LIGHT = "E8EDF5";
const GREY = "595959";

const PAGE_W = 11906; // A4 en twips (1/20 pt)
const PAGE_H = 16838;
const MARGIN = 1417; // 2,5 cm
const CONTENT_W = PAGE_W - 2 * MARGIN; // 9072

const STATUT_LABEL: Record<string, string> = {
  present: "Présent(e)",
  excuse: "Excusé(e)",
  absent: "Absent(e)",
  invite: "Invité(e)",
};

/* ------------------------------ Utilitaires ------------------------------ */

const NO_BORDER: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};
const GRID: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: "8EA9DB" };
const GRID_BORDERS = {
  top: GRID,
  bottom: GRID,
  left: GRID,
  right: GRID,
  insideHorizontal: GRID,
  insideVertical: GRID,
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function formatDateFr(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Transforme un texte (lignes vides = paragraphes, sauts de ligne = retours) en paragraphes Word. */
function textParagraphs(text: string, opts: { indentFirst?: boolean } = {}): Paragraph[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n");
    const children: ParagraphChild[] = lines.map(
      (line, i) => new TextRun({ text: line, break: i > 0 ? 1 : undefined }),
    );
    return new Paragraph({
      children,
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120, line: 300 },
      indent: opts.indentFirst ? { firstLine: 425 } : undefined,
    });
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, keepNext: true });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, keepNext: true });
}

interface CellOpts {
  bold?: boolean;
  header?: boolean;
  width: number;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  shade?: string;
}

function cell(text: string, o: CellOpts): TableCell {
  const lines = (text || "").split("\n");
  return new TableCell({
    width: { size: o.width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: o.header
      ? { type: ShadingType.CLEAR, fill: NAVY, color: "auto" }
      : o.shade
        ? { type: ShadingType.CLEAR, fill: o.shade, color: "auto" }
        : undefined,
    children: [
      new Paragraph({
        alignment: o.align ?? AlignmentType.LEFT,
        children: lines.map(
          (l, i) =>
            new TextRun({
              text: l,
              bold: o.bold || o.header,
              color: o.header ? "FFFFFF" : undefined,
              size: 20,
              break: i > 0 ? 1 : undefined,
            }),
        ),
      }),
    ],
  });
}

/** Tableau à en-tête coloré, répété automatiquement en haut de chaque page. */
function dataTable(headers: string[], widths: number[], rows: string[][], centerCols: number[] = []): Table {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: GRID_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map((h, i) => cell(h, { header: true, width: widths[i], align: AlignmentType.CENTER })),
      }),
      ...rows.map(
        (r, ri) =>
          new TableRow({
            cantSplit: true,
            children: r.map((v, i) =>
              cell(v, {
                width: widths[i],
                align: centerCols.includes(i) ? AlignmentType.CENTER : AlignmentType.LEFT,
                shade: ri % 2 === 1 ? "F5F7FB" : undefined,
              }),
            ),
          }),
      ),
    ],
  });
}

function spacer(after = 120) {
  return new Paragraph({ spacing: { after }, children: [] });
}

/* ------------------------------ En-têtes / pied de page ------------------------------ */

function officialHeader(org: OrgSettings, logo: LogoImage | null): Header {
  const logoW = 1700;
  const textW = CONTENT_W - logoW;
  const logoParagraph = logo
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: "png",
            data: logo.data,
            transformation: fitBox(logo, 80, 112), // logo officiel au format portrait
            altText: { name: "Logo", title: `Logo ${org.sigle}`, description: `Logo ${org.sigle}` },
          }),
        ],
      })
    : new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: org.sigle, bold: true, color: NAVY, size: 22 })],
      });

  const textLines: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: org.nomLong.toUpperCase(), bold: true, color: NAVY, size: 22 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40 },
      children: [new TextRun({ text: `« ${org.sigle} »`, bold: true, color: GOLD, size: 26 })],
    }),
  ];
  if (org.service)
    textLines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: org.service, italics: true, size: 20, color: GREY })],
      }),
    );
  const contact = [org.adresse, org.contact].filter(Boolean).join(" — ");
  if (contact)
    textLines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: contact, size: 16, color: GREY })],
      }),
    );
  if (org.devise)
    textLines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: org.devise, italics: true, size: 16, color: GOLD })],
      }),
    );

  return new Header({
    children: [
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [logoW, textW],
        layout: TableLayoutType.FIXED,
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: logoW, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                borders: NO_BORDERS,
                children: [logoParagraph],
              }),
              new TableCell({
                width: { size: textW, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                borders: NO_BORDERS,
                children: textLines,
              }),
            ],
          }),
        ],
      }),
      // Double filet institutionnel sous l'en-tête
      new Paragraph({
        spacing: { before: 60, after: 0 },
        border: { bottom: { style: BorderStyle.THICK_THIN_SMALL_GAP, size: 18, color: NAVY, space: 1 } },
        children: [],
      }),
    ],
  });
}

function compactHeader(org: OrgSettings, docLabel: string, dateFr: string): Header {
  return new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 1 } },
        children: [
          new TextRun({ text: org.sigle, bold: true, color: NAVY, size: 18 }),
          new TextRun({ text: `\t${docLabel}${dateFr ? ` du ${dateFr}` : ""}`, italics: true, color: GREY, size: 16 }),
        ],
      }),
    ],
  });
}

function pageFooter(org: OrgSettings): Footer {
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: GOLD, space: 1 } },
        children: [
          new TextRun({ text: `${org.sigle} — ${org.service || "Document interne"}`, size: 16, color: GREY }),
          new TextRun({ children: ["\tPage ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 16, color: GREY }),
        ],
      }),
    ],
  });
}

/* ------------------------------ Construction du document ------------------------------ */

export interface GenerateOptions {
  pv: PVContent;
  meeting: MeetingInfo;
  org: OrgSettings;
  docType: DocType;
  reference?: string;
}

export async function buildPVDocument({ pv, meeting, org, docType, reference }: GenerateOptions): Promise<Document> {
  const logo = await loadLogo(org.logoDataUrl);
  const dateFr = formatDateFr(meeting.date);
  const docLabel = docType === "synthetique" ? "Compte-rendu" : "Procès-verbal";
  const year = (meeting.date || new Date().toISOString()).slice(0, 4);

  let sectionNo = 0;
  const nextHeading = (title: string) => heading(`${ROMAN[sectionNo++] ?? sectionNo}. ${title}`);

  const body: (Paragraph | Table)[] = [];

  // Référence + titre
  body.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: reference || `Réf. : N° ……… /${org.sigle}/SG/${year}`,
          size: 18,
          color: GREY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: (pv.titre || `${docLabel.toUpperCase()} DE LA RÉUNION`).toUpperCase(),
          bold: true,
          size: 30,
          color: NAVY,
        }),
      ],
    }),
  );
  if (meeting.titre)
    body.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: meeting.titre, bold: true, size: 24 })],
      }),
    );
  body.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 6 } },
      children: [
        new TextRun({
          text: [dateFr && `Séance du ${dateFr}`, meeting.lieu].filter(Boolean).join(" — "),
          italics: true,
          size: 22,
        }),
        new TextRun({ text: DOC_TYPE_LABELS[docType], break: 1, size: 18, color: GREY }),
      ],
    }),
  );

  // I. Informations générales
  body.push(nextHeading("INFORMATIONS GÉNÉRALES"));
  const infoRows: [string, string][] = [
    ["Type de réunion", meeting.typeReunion],
    ["Date", dateFr],
    ["Horaire", [meeting.heureDebut && `Début : ${meeting.heureDebut}`, meeting.heureFin && `Fin : ${meeting.heureFin}`].filter(Boolean).join("   ")],
    ["Lieu", meeting.lieu],
    ["Présidence de séance", meeting.president],
    ["Secrétaire / Rapporteur", meeting.secretaire],
  ];
  const labelW = 2900;
  body.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [labelW, CONTENT_W - labelW],
      layout: TableLayoutType.FIXED,
      borders: GRID_BORDERS,
      rows: infoRows.map(
        ([k, v]) =>
          new TableRow({
            cantSplit: true,
            children: [
              cell(k, { bold: true, width: labelW, shade: LIGHT }),
              cell(v || "À préciser", { width: CONTENT_W - labelW }),
            ],
          }),
      ),
    }),
    spacer(),
  );

  // II. Participants
  if (meeting.participants.length) {
    body.push(nextHeading("PARTICIPANTS"));
    const count = (s: string) => meeting.participants.filter((p) => p.statut === s).length;
    body.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: `Présents : ${count("present") + count("invite")}   •   Excusés : ${count("excuse")}   •   Absents : ${count("absent")}`,
            italics: true,
            size: 20,
          }),
        ],
      }),
      dataTable(
        ["N°", "Nom et prénom", "Fonction / Institut", "Statut"],
        [700, 3300, 3372, 1700],
        meeting.participants.map((p, i) => [String(i + 1), p.nom, p.fonction, STATUT_LABEL[p.statut] ?? p.statut]),
        [0, 3],
      ),
      spacer(),
    );
  }

  // III. Ordre du jour
  if (meeting.ordreDuJour.length) {
    body.push(nextHeading("ORDRE DU JOUR"));
    meeting.ordreDuJour.forEach((item) =>
      body.push(
        new Paragraph({
          numbering: { reference: "agenda", level: 0 },
          spacing: { after: 60 },
          children: [new TextRun(item)],
        }),
      ),
    );
    body.push(spacer());
  }

  // IV. Déroulement
  body.push(nextHeading(docType === "synthetique" ? "SYNTHÈSE DES ÉCHANGES" : "DÉROULEMENT DE LA SÉANCE"));
  if (pv.resumeGeneral) body.push(...textParagraphs(pv.resumeGeneral, { indentFirst: true }));
  const parentNo = ROMAN[sectionNo - 1] ?? String(sectionNo); // ex. « IV » → sous-titres IV.1, IV.2…
  pv.sections.forEach((s, i) => {
    body.push(subHeading(`${parentNo}.${i + 1}. ${s.titre}`));
    body.push(...textParagraphs(s.contenu || "—", { indentFirst: true }));
  });

  // V. Décisions et résolutions
  body.push(nextHeading("DÉCISIONS ET RÉSOLUTIONS"));
  if (pv.decisions.length) {
    body.push(
      dataTable(
        ["N°", "Nature", "Décision / Résolution", "Détails et modalités"],
        [700, 1500, 3700, 3172],
        pv.decisions.map((d, i) => [
          String(i + 1),
          d.type === "resolution" ? "Résolution" : "Décision",
          d.intitule,
          d.details || "—",
        ]),
        [0, 1],
      ),
    );
  } else {
    body.push(new Paragraph({ children: [new TextRun({ text: "Aucune décision formelle n'a été prise.", italics: true })] }));
  }
  body.push(spacer());

  // VI. Recommandations
  if (pv.recommandations.length) {
    body.push(nextHeading("RECOMMANDATIONS"));
    pv.recommandations.forEach((r) =>
      body.push(
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 60 },
          children: [new TextRun(r)],
        }),
      ),
    );
    body.push(spacer());
  }

  // VII. Plan d'action
  body.push(nextHeading("PLAN D'ACTION ET SUIVI DES RÉSOLUTIONS"));
  if (pv.planAction.length) {
    body.push(
      dataTable(
        ["N°", "Action à mener", "Responsable", "Échéance", "Statut"],
        [600, 3772, 1900, 1500, 1300],
        pv.planAction.map((a, i) => [String(i + 1), a.action, a.responsable, a.echeance, a.statut]),
        [0, 3, 4],
      ),
    );
  } else {
    body.push(new Paragraph({ children: [new TextRun({ text: "Aucune action n'a été assignée.", italics: true })] }));
  }
  body.push(spacer());

  // VIII. Divers / prochaine réunion / clôture
  if (pv.pointsDivers.trim()) {
    body.push(nextHeading("POINTS DIVERS"), ...textParagraphs(pv.pointsDivers));
  }
  if (pv.prochaineReunion.trim()) {
    body.push(nextHeading("PROCHAINE RÉUNION"), ...textParagraphs(pv.prochaineReunion));
  }
  body.push(nextHeading("CLÔTURE"), ...textParagraphs(pv.cloture || "L'ordre du jour étant épuisé, la séance a été levée."));

  // Signatures
  body.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 360, after: 360 },
      keepNext: true,
      children: [
        new TextRun({
          text: `Fait à ${meeting.lieu || "……………"}, le ${dateFr || "……………"}`,
          italics: true,
        }),
      ],
    }),
  );
  const half = CONTENT_W / 2;
  const sigCell = (role: string, name: string) =>
    new TableCell({
      width: { size: half, type: WidthType.DXA },
      borders: NO_BORDERS,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: role, bold: true, underline: {} })],
        }),
        new Paragraph({ spacing: { before: 1000 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: name || "………………………………", bold: true })],
        }),
      ],
    });
  body.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [half, half],
      layout: TableLayoutType.FIXED,
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            sigCell("Le/La Secrétaire de séance", meeting.secretaire),
            sigCell("Le/La Président(e) de séance", meeting.president),
          ],
        }),
      ],
    }),
  );

  return new Document({
    creator: org.sigle,
    title: pv.titre || `${docLabel} ${org.sigle}`,
    description: `${DOC_TYPE_LABELS[docType]} — ${meeting.titre}`,
    styles: {
      default: {
        document: { run: { font: org.police || "Cambria", size: 22 } },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { bold: true, size: 24, color: NAVY, font: org.police || "Cambria" },
          paragraph: {
            spacing: { before: 280, after: 140 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 2 } },
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { bold: true, size: 22, color: NAVY, font: org.police || "Cambria" },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "agenda",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          titlePage: true, // en-tête officiel complet sur la 1re page uniquement
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 567, footer: 567 },
          },
        },
        headers: {
          first: officialHeader(org, logo),
          default: compactHeader(org, docLabel, dateFr),
        },
        footers: { first: pageFooter(org), default: pageFooter(org) },
        children: body,
      },
    ],
  });
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/** Génère le .docx et déclenche le téléchargement dans le navigateur. */
export async function downloadPVDocx(options: GenerateOptions): Promise<void> {
  const doc = await buildPVDocument(options);
  const blob = await Packer.toBlob(doc);
  const prefix = options.docType === "synthetique" ? "CR" : "PV";
  const name = `${prefix}_${options.org.sigle}_${options.meeting.date || "sans-date"}${
    options.meeting.titre ? "_" + slug(options.meeting.titre) : ""
  }.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
