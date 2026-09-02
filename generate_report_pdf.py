import os
import sys
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages after cover)
        if self._pageNumber > 1:
            self.drawString(54, 11 * inch - 36, "Jan Seva (जन सेवा) — Comprehensive Project & Architecture Report")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)
        
        # Footer
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 48, 8.5 * inch - 54, 48)
        
        self.drawString(54, 34, "CONFIDENTIAL & PROPRIETARY — MUNICIPAL CIVIC PLATFORM")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 34, page_str)
        self.restoreState()

def generate_pdf(filename="Jan_Seva_Comprehensive_Project_Report.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    primary_color = colors.HexColor("#1E3A8A")    # Deep Navy Blue
    secondary_color = colors.HexColor("#0284C7")  # Bright Blue
    dark_text = colors.HexColor("#0F172A")        # Slate 900
    subtle_text = colors.HexColor("#475569")      # Slate 600
    card_bg = colors.HexColor("#F8FAFC")          # Slate 50
    border_color = colors.HexColor("#E2E8F0")     # Slate 200
    accent_green = colors.HexColor("#059669")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=primary_color,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=subtle_text,
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=primary_color,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=secondary_color,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=dark_text,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'BulletDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=dark_text,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B")
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    )

    table_body_style = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=dark_text
    )

    story = []

    # Title & Metadata Banner
    story.append(Paragraph("JAN SEVA (जन सेवा)", title_style))
    story.append(Paragraph("Comprehensive Project Architecture, Technical Analysis & System Specification", subtitle_style))
    
    meta_table_data = [
        [
            Paragraph("<b>Target Municipality:</b> Gwalior Municipal Corporation", table_body_style),
            Paragraph("<b>Stack:</b> React 19 + TypeScript + Vite", table_body_style)
        ],
        [
            Paragraph("<b>Version:</b> 1.0.0 Production Ready", table_body_style),
            Paragraph("<b>Standards:</b> Open311 / DPDP Act 2023", table_body_style)
        ]
    ]
    meta_table = Table(meta_table_data, colWidths=[250, 254])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#BFDBFE")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # SECTION 1: PROJECT OVERVIEW
    story.append(Paragraph("1. Project Overview", h1_style))
    story.append(Paragraph(
        "<b>Jan Seva (जन सेवा)</b> is an enterprise-grade civic grievance redressal and municipal operations platform. "
        "Unlike legacy portals that act as passive complaint dumpyards, Jan Seva operates as an active, closed-loop civic operating system "
        "designed to eliminate ticket duplication, eradicate ghost/fake resolutions, and ensure complete transparency.",
        body_style
    ))
    story.append(Paragraph("<b>The Core Problems Solved:</b>", h2_style))
    story.append(Paragraph("• <b>Ticket Duplication & Clutter:</b> Tens of residents reporting the same pothole or broken streetlight traditionally created dozens of isolated tickets, overloading department queues.", bullet_style))
    story.append(Paragraph("• <b>Fraudulent & Ghost Resolutions:</b> Field workers frequently close grievances using old photos, screenshots from messaging apps, or photos taken from depots.", bullet_style))
    story.append(Paragraph("• <b>DPDP Act Non-Compliance:</b> Citizen phone numbers and Aadhaar numbers exposed in plain text to field contractors, creating privacy risks.", bullet_style))
    story.append(Paragraph("• <b>Lack of SLA Accountability:</b> Grievances disappear into administrative voids without real-time citizen tracking or escalation triggers.", bullet_style))

    story.append(Spacer(1, 8))

    # SECTION 2: COMPLETE WORKFLOW
    story.append(Paragraph("2. Complete End-to-End Workflow", h1_style))
    story.append(Paragraph(
        "The system enforces a 5-stage citizen reporting wizard linked directly to department dispatch and commissioner command oversight:",
        body_style
    ))
    
    flow_steps = [
        ["Step", "Phase", "Technical Execution"],
        ["01", "Photo Capture", "Camera shutter / gallery picker. Canvas 2D scales to 1600px, matting transparency to white and re-compressing JPEG < 900 KB."],
        ["02", "Description & Voice", "Real-time speech recognition (Web Speech API) with bilingual Hindi/English NLP keyword classification."],
        ["03", "Identity & Masking", "Aadhaar / Mobile OTP challenge. Raw identifiers hashed into HMAC tokens; display masked as XXXX-XXXX-4210."],
        ["04", "Dual-Location GPS", "Device GPS fix combined with OpenStreetMap Nominatim reverse geocoding and fallback landmark search."],
        ["05", "Screening & Review", "Pre-submission fail-open risk pipeline checks dHash image novelty and 150m spatial duplicate clusters."],
        ["06", "Department Dispatch", "Auto-routed to PWD/Sanitation/Water Works/Electrical with computed SLA countdowns and Work Cards."],
        ["07", "Proof Resolution", "Field crew captures on-site fix photo. Proof Engine validates live shutter, GPS < 120m, and dHash originality."],
        ["08", "Citizen Closure", "Resolution photo and verified badge published to citizen tracking timeline with 72h re-open window."]
    ]
    flow_table = Table([[Paragraph(c, table_header_style if i==0 else table_body_style) for c in row] for i, row in enumerate(flow_steps)], colWidths=[35, 110, 359])
    flow_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, card_bg]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(flow_table)

    story.append(Spacer(1, 10))

    # SECTION 3: FEATURES ANALYSIS
    story.append(Paragraph("3. Deep Features Analysis", h1_style))
    feature_rows = [
        ["Feature Name", "Internal Implementation", "Civic / Admin Benefit"],
        ["Perceptual Proof Engine", "Calculates 64-bit dHash on canvas; validates camera GPS <= 120m from issue.", "Eradicates ghost resolutions and duplicate contractor billing."],
        ["Spatial Duplicate Grouping", "Haversine distance (geoService.ts) clusters reports <= 150m into single root issue.", "Prevents ticket duplication; pools citizen support into one high-priority ticket."],
        ["Fail-Open Screening", "Multi-signal risk score (image reuse, submission bursts) with fail-open guarantee.", "Spam and non-civic memes are filtered without blocking real emergencies."],
        ["DPDP Privacy Shield", "Irreversible HMAC identity tokens (identityService.ts) and client-side masking.", "Protects citizen phone numbers and Aadhaar IDs from field contractors."],
        ["Bilingual i18n & Voice", "Context-aware i18n dictionary (strings.ts) and Web Speech API dictation.", "Provides seamless accessibility for non-literate and regional Hindi speakers."],
        ["Executive Command Centre", "Geospatial heatmaps, live SLA burn-down rates, department escalations, open data.", "Gives Municipal Commissioners total operational visibility and control."]
    ]
    feature_table = Table([[Paragraph(c, table_header_style if i==0 else table_body_style) for c in row] for i, row in enumerate(feature_rows)], colWidths=[110, 204, 190])
    feature_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, card_bg]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(feature_table)

    story.append(Spacer(1, 10))

    # SECTION 4: SYSTEM ARCHITECTURE & TECH STACK
    story.append(Paragraph("4. System Architecture & Technical Stack", h1_style))
    story.append(Paragraph(
        "Jan Seva is architected as a high-performance, modular React 19 Single Page Application (SPA) leveraging a local-first service layer with asynchronous external integrations:",
        body_style
    ))
    
    stack_data = [
        ["Layer", "Technology", "Role in Jan Seva"],
        ["Frontend UI", "React 19.2.8 + React Router 7", "Concurrent rendering, route-level code splitting, lazy loading."],
        ["Language", "TypeScript ~6.0.2", "Strict domain type definitions across complaints, proofs, and screening."],
        ["Styling System", "Vanilla CSS Custom Properties", "Zero-runtime overhead design system with dark mode and micro-interactions."],
        ["Bundling", "Vite 8.2.2 (ESBuild / Rollup)", "Sub-second HMR and tree-shaken production asset packaging."],
        ["Analytics", "@vercel/analytics 2.0.1", "Real-time client telemetry, Web Vitals, and route conversion tracking."],
        ["Mapping & Geo", "OpenStreetMap Nominatim API", "Live reverse geocoding, address structuring, and landmark lookup."],
        ["Verification", "HTML5 Canvas 2D + dHash", "Client-side image scaling, thumbnailing, and perceptual difference hashing."],
        ["Storage Engine", "LocalStorage / IndexedDB Engine", "Versioned storage schemas with migrations, seed hydration, and optimistic updates."]
    ]
    stack_table = Table([[Paragraph(c, table_header_style if i==0 else table_body_style) for c in row] for i, row in enumerate(stack_data)], colWidths=[90, 150, 264])
    stack_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, card_bg]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(stack_table)

    story.append(Spacer(1, 10))

    # SECTION 5: MODULE-WISE BREAKDOWN
    story.append(Paragraph("5. Module-wise Breakdown", h1_style))
    story.append(Paragraph("<b>1. Public Citizen Portal (`/`, `/report`, `/track`):</b> Frictionless 5-step reporting wizard with draft persistence, instant verification, live timeline tracking, and feedback submission.", bullet_style))
    story.append(Paragraph("<b>2. Department Operations Portal (`/dept/*`):</b> Role-based dispatch workspaces for PWD, Sanitation, Water Works, Electrical, and Urban Infra. Includes Work Cards, Map View, and Shutter Proof validation.", bullet_style))
    story.append(Paragraph("<b>3. Municipal Admin Command Centre (`/admin/*`):</b> Executive dashboard for Municipal Commissioners featuring real-time city health index, SLA burn-down rates, cross-department transfers, and Open311 / GeoJSON export.", bullet_style))
    story.append(Paragraph("<b>4. Moderation & Audit Engine (`/admin/moderation`, `/admin/ledger`):</b> Append-only chronological audit log tracking every state change, reason, and actor ID with moderation review queues.", bullet_style))

    story.append(Spacer(1, 10))

    # SECTION 6: DATA SCHEMAS & SECURITY
    story.append(Paragraph("6. Data Architecture, Security & DPDP Compliance", h1_style))
    story.append(Paragraph(
        "<b>Data Collections:</b> `jan_seva_complaints_v1`, `jan_seva_issues_v1`, `jan_seva_audit_log_v1`, `jan_seva_moderation_cases_v1`, `jan_seva_evidence_hashes_v1`, `jan_seva_portal_session_v1`.<br/>"
        "<b>Security Controls:</b> Role-Based Access Control (RBAC), exponential login throttling, masked citizen records, DPDP Act 2023 compliance, tamper-evident audit logs, and fail-open screening pipelines.",
        body_style
    ))

    story.append(Spacer(1, 10))

    # SECTION 7: VIVA & PRESENTATION GUIDE
    story.append(Paragraph("7. Viva & Project Review Presentation Summary", h1_style))
    
    viva_box_data = [[Paragraph(
        "<b>Executive Presentation Script:</b><br/>"
        "<i>\"Jan Seva transforms civic grievance redressal from a broken ticketing form into a verifiable, closed-loop civic operating system. "
        "Our three core technical pillars are: (1) Dual-Location & Spatial Clustering (150m) to eliminate ticket duplication, "
        "(2) Perceptual Proof Verification (dHash + GPS <= 120m) to stop ghost/fake closures, and (3) DPDP Act 2023 Compliant Identity Masking. "
        "Built with React 19, TypeScript, and Vite, the platform features offline resilience, English/Hindi localization, Open311 compliance, "
        "and over 100 automated self-test verification suites.\"</i>",
        callout_style
    )]]
    viva_box = Table(viva_box_data, colWidths=[504])
    viva_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#F59E0B")),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(viva_box)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated at: {filename}")

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "Jan_Seva_Comprehensive_Project_Report.pdf"
    generate_pdf(out)
