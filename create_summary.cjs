const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType, HeadingLevel, LevelFormat, PageBreak } = require("docx");
const fs = require("fs");

const border = { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "1E293B" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "334155" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [
      // Title
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
        new TextRun({ text: "DevScout", font: "Arial", size: 56, bold: true, color: "4F46E5" }),
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [
        new TextRun({ text: "AI-Powered Prospecting Tool", font: "Arial", size: 24, color: "64748B" }),
      ]}),

      // Divider
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "4F46E5", space: 1 } }, spacing: { after: 400 }, children: [] }),

      // What is DevScout?
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("What is DevScout?")] }),
      new Paragraph({ spacing: { after: 200 }, children: [
        new TextRun({ text: "DevScout is an AI-powered sales prospecting tool built specifically for BairesDev. It automates the process of finding companies that are actively hiring software developers, identifying the right hiring contacts, and generating personalized outreach sequences.", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ spacing: { after: 300 }, children: [
        new TextRun({ text: "The tool eliminates hours of manual research by scanning five major job boards simultaneously, scoring each prospect on fit and nearshore propensity, and drafting ready-to-send email sequences.", size: 22, color: "475569" }),
      ]}),

      // How It Works
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("How It Works")] }),

      // Step 1
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1. AI-Powered Scan")] }),
      new Paragraph({ spacing: { after: 100 }, children: [
        new TextRun({ text: "The user clicks ", size: 22, color: "475569" }),
        new TextRun({ text: "Scan for Prospects", size: 22, bold: true, color: "4F46E5" }),
        new TextRun({ text: ". DevScout uses Claude AI with real-time web search to scan across ", size: 22, color: "475569" }),
        new TextRun({ text: "Indeed, LinkedIn, ZipRecruiter, BuiltIn, and Dice", size: 22, bold: true, color: "475569" }),
        new TextRun({ text: " simultaneously. It finds companies actively hiring developers with 100-15,000 employees, focusing on non-tech industries (healthcare, finance, manufacturing, logistics, etc.).", size: 22, color: "475569" }),
      ]}),

      // Step 2
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2. Intelligent Scoring")] }),
      new Paragraph({ spacing: { after: 80 }, children: [
        new TextRun({ text: "Each prospect receives a Match Score (0-100) based on a 50/50 blend of:", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Hiring Fit", bold: true, size: 22 }), new TextRun({ text: " \u2014 number of open dev roles, company size, industry, hiring urgency", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [
        new TextRun({ text: "Nearshore Propensity", bold: true, size: 22 }), new TextRun({ text: " \u2014 scaling pain, high-cost location, non-tech primary industry", size: 22, color: "475569" }),
      ]}),

      // Step 3
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3. Contact Discovery")] }),
      new Paragraph({ spacing: { after: 200 }, children: [
        new TextRun({ text: "For each prospect, DevScout identifies the hiring manager or recruiter from the job posting or LinkedIn. It then uses ", size: 22, color: "475569" }),
        new TextRun({ text: "Apollo.io integration", size: 22, bold: true, color: "475569" }),
        new TextRun({ text: " to find verified work email addresses \u2014 not guesses, but real deliverable emails.", size: 22, color: "475569" }),
      ]}),

      // Step 4
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4. LinkedIn Connection Cross-Reference")] }),
      new Paragraph({ spacing: { after: 100 }, children: [
        new TextRun({ text: "Each salesperson uploads their LinkedIn connections CSV (exported from LinkedIn\u2019s Data Privacy settings) to their DevScout profile. During every scan, DevScout automatically cross-references prospects against the user\u2019s network:", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Company Matches", bold: true, size: 22 }), new TextRun({ text: " \u2014 flags prospects where the user has 1st-degree connections at that company, with names and roles", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Recruiter Matches", bold: true, size: 22 }), new TextRun({ text: " \u2014 identifies if the hiring contact is a direct connection, enabling warm outreach instead of cold", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [
        new TextRun({ text: "Connection Badges", bold: true, size: 22 }), new TextRun({ text: " \u2014 prospect cards display \u201C1st\u201D degree badges with mutual connection details, helping salespeople prioritize warm leads", size: 22, color: "475569" }),
      ]}),

      // Step 5 (was 4)
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5. AI Research Brief")] }),
      new Paragraph({ spacing: { after: 100 }, children: [
        new TextRun({ text: "Before generating outreach, Claude conducts real-time research on each prospect to build context for personalized messaging:", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Company Intelligence", bold: true, size: 22 }), new TextRun({ text: " \u2014 recent news, funding rounds, product launches, growth signals, and digital transformation initiatives", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Recruiter Background", bold: true, size: 22 }), new TextRun({ text: " \u2014 the hiring manager\u2019s role, tenure, recent activity, and what they\u2019re prioritizing", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Role Analysis", bold: true, size: 22 }), new TextRun({ text: " \u2014 specific technologies, seniority levels, and team structure signals from the job postings", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [
        new TextRun({ text: "Talking Points", bold: true, size: 22 }), new TextRun({ text: " \u2014 specific angles to reference in outreach (e.g., \u201CL\u2019Oreal investing $140M in NJ innovation center\u201D or \u201CHiring surge after Series C\u201D)", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ spacing: { after: 300 }, children: [
        new TextRun({ text: "This research brief is displayed to the salesperson before they send any emails, giving them full context for the conversation and enabling them to personalize further if needed.", size: 22, color: "475569" }),
      ]}),

      // Step 6
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6. Automated Outreach Sequences")] }),
      new Paragraph({ spacing: { after: 100 }, children: [
        new TextRun({ text: "When a salesperson clicks ", size: 22, color: "475569" }),
        new TextRun({ text: "Start Sequence", size: 22, bold: true, color: "4F46E5" }),
        new TextRun({ text: ", the AI generates a personalized 3-email outreach sequence:", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Intro Email", bold: true, size: 22 }), new TextRun({ text: " \u2014 personalized hook referencing company news, open roles, and a relevant BairesDev case study. Max 75 words.", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Follow-up 1 (Day 3)", bold: true, size: 22 }), new TextRun({ text: " \u2014 adds new value with a different angle or insight.", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [
        new TextRun({ text: "Follow-up 2 (Day 7)", bold: true, size: 22 }), new TextRun({ text: " \u2014 brief breakup email, leaves the door open.", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ spacing: { after: 300 }, children: [
        new TextRun({ text: "Emails can be copied or drafted directly in Gmail with the recruiter\u2019s email pre-filled.", size: 22, color: "475569" }),
      ]}),

      // Page Break
      new Paragraph({ children: [new PageBreak()] }),

      // Multi-User / Team
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Multi-User Team Platform")] }),
      new Paragraph({ spacing: { after: 100 }, children: [
        new TextRun({ text: "DevScout is built for team collaboration:", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Shared Prospect Pool", bold: true, size: 22 }), new TextRun({ text: " \u2014 all prospects are visible to all team members", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Prospect Claiming", bold: true, size: 22 }), new TextRun({ text: " \u2014 when a user starts a sequence, the prospect is \u201Cclaimed\u201D and locked. Other users see \u201CAssigned to [Name]\u201D preventing duplicate outreach", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Dashboard", bold: true, size: 22 }), new TextRun({ text: " \u2014 tracks emails sent, responses received, response rate, and API usage per user", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Admin Panel", bold: true, size: 22 }), new TextRun({ text: " \u2014 manage team accounts, enable/disable users, reset passwords", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 300 }, children: [
        new TextRun({ text: "Persistent Data", bold: true, size: 22 }), new TextRun({ text: " \u2014 prospects and sequences are saved to a cloud database (Supabase) and persist across sessions", size: 22, color: "475569" }),
      ]}),

      // Tech Stack
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Technology Stack")] }),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 6240],
        rows: [
          ["Component", "Technology"],
          ["AI Engine", "Claude Haiku 4.5 (Anthropic) with real-time web search"],
          ["Frontend", "React (single-page app), deployed on Netlify"],
          ["Backend", "Netlify Serverless Functions (Node.js)"],
          ["Database", "Supabase (PostgreSQL) with row-level security"],
          ["Auth", "Supabase Auth (email/password)"],
          ["Contact Enrichment", "Apollo.io API (verified email lookup)"],
          ["Email Integration", "Gmail draft links with pre-filled To/Subject/Body"],
        ].map((row, i) => new TableRow({
          children: row.map((cell, j) => new TableCell({
            borders,
            width: { size: j === 0 ? 3120 : 6240, type: WidthType.DXA },
            shading: i === 0 ? { fill: "4F46E5", type: ShadingType.CLEAR } : undefined,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: cell, bold: i === 0, size: 20, color: i === 0 ? "FFFFFF" : "475569", font: "Arial" })] })]
          }))
        }))
      }),

      // Cost
      new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400 }, children: [new TextRun("Cost Per Scan")] }),
      new Paragraph({ spacing: { after: 100 }, children: [
        new TextRun({ text: "DevScout uses Claude Haiku 4.5, the most cost-efficient model:", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Single scan: ~$0.10-0.15", bold: true, size: 22 }), new TextRun({ text: " (4-6 prospects with recruiter contacts)", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Email sequence generation: ~$0.03-0.05", bold: true, size: 22 }), new TextRun({ text: " per prospect", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [
        new TextRun({ text: "Apollo email lookups: free tier", bold: true, size: 22 }), new TextRun({ text: " (100/month)", size: 22, color: "475569" }),
      ]}),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 300 }, children: [
        new TextRun({ text: "Estimated team cost: $1-5/day", bold: true, size: 22 }), new TextRun({ text: " for 5 salespeople running 5-10 scans each", size: 22, color: "475569" }),
      ]}),

      // Divider
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "4F46E5", space: 1 } }, spacing: { after: 300 }, children: [] }),

      // Summary
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
        new TextRun({ text: "DevScout transforms hours of manual prospecting into minutes.", size: 24, bold: true, color: "1E293B", font: "Arial" }),
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
        new TextRun({ text: "Live at: ", size: 22, color: "64748B" }),
        new TextRun({ text: "dev-scout-prod.netlify.app", size: 22, color: "4F46E5", bold: true }),
      ]}),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("C:\\Github_folder\\devscout\\DevScout_Executive_Summary.docx", buffer);
  console.log("Created DevScout_Executive_Summary.docx");
});
