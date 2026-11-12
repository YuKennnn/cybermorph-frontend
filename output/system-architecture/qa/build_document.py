from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

out = Path(__file__).resolve().parent.parent
doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.top_margin = sec.bottom_margin = Inches(.6)
sec.left_margin = sec.right_margin = Inches(.8)
normal = doc.styles['Normal']
normal.font.name = 'Calibri'
normal.font.size = Pt(11)
normal.paragraph_format.space_after = Pt(7)
normal.paragraph_format.line_spacing = 1.08
for name, size in [('Title', 21), ('Heading 1', 15), ('Heading 2', 12)]:
    st = doc.styles[name]
    st.font.name = 'Calibri'
    st.font.size = Pt(size)
    st.font.color.rgb = RGBColor(0, 0, 0)
    st.paragraph_format.space_before = Pt(10 if name != 'Title' else 0)
    st.paragraph_format.space_after = Pt(6)
doc.add_paragraph('CyberMorph System Architecture', 'Title')
doc.add_paragraph('CyberMorph combines offline mobile gameplay with an online account and progress portal. The architecture connects its runtime services, AI research process, and software delivery workflow.')
p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(4)
run = p.add_run()
pic = run.add_picture(str(out / 'cybermorph-system-architecture.png'), width=Inches(6.9))
pic._inline.docPr.set('descr', 'Combined CyberMorph architecture showing the offline Godot game, JSON storage, planned SQLite, Vue portal, FastAPI, PostgreSQL, manual research export, AI training, and delivery of signed APKs and backend releases.')
p = doc.add_paragraph('Figure 1. Runtime, research, and delivery architecture. SQLite is a planned design; the built game uses JSON files. The dashed arrow represents model export, and the dashed storage border identifies planned SQLite.')
p.paragraph_format.space_after = Pt(0)
for r in p.runs:
    r.font.size = Pt(10)
doc.add_page_break()
doc.add_paragraph('Components and Data Flow', 'Heading 1')
doc.add_paragraph('The Godot Android game is the primary gameplay client. It runs game logic and the bundled AI model on the device, allowing independent play without a network connection. Classroom participation is optional.')
doc.add_paragraph('The Vue 3 web portal provides Player progress and leaderboard views, Educator classroom management and student analytics, and Admin approval and log views. Vue Router handles navigation, Pinia manages application state, and dedicated API modules communicate with FastAPI.')
doc.add_paragraph('FastAPI on Render exposes the /v1 API and handles authentication, authorization, input validation, and server-side processing. It accesses PostgreSQL through SQLAlchemy asynchronous sessions and asyncpg over SSL. Neither the mobile client nor the portal accesses the cloud database directly.')
doc.add_paragraph('Offline Storage and Synchronization', 'Heading 2')
doc.add_paragraph('The built game stores local records in JSON files under Godot\u2019s user:// directory, including guest and player records, pending runs, and authentication data. Runs are saved locally first. SQLite is the planned alternative for local gameplay records and a pending synchronization queue; it is not shown as an implemented database.')
doc.add_paragraph('When online and authenticated, the game can submit sessions and supported synchronization records to FastAPI. The backend validates submitted data, persists it in PostgreSQL, and returns relevant progress information. The portal reads synchronized cloud records through its API endpoints; its views are not a live feed of offline play.')
doc.add_paragraph('Research and Model Delivery', 'Heading 2')
doc.add_paragraph('Research play data is uploaded through the game\u2019s play-data API and retrieved through authorized Admin API access. A manual export supplies the developer-side training pipeline. PPO, DQN, and A2C models are compared with baselines, and selected frozen weights are exported as JSON for bundling into a later Godot build.')
doc.add_paragraph('The signed APK carries the model to players\u2019 phones. Inference runs locally during play; training occurs separately on the developer PC. Backend code is deployed to Render, while Alembic migrations manage PostgreSQL schema changes.')
doc.add_paragraph('Authentication and Security Boundaries', 'Heading 2')
doc.add_paragraph('Client API communication uses HTTPS and JSON, with bearer JWTs on protected requests. FastAPI enforces user roles and resource access. Frontend route guards guide navigation but are not a security boundary. Educator accounts require Admin approval before portal access.')
doc.core_properties.title = 'CyberMorph System Architecture'
doc.core_properties.subject = 'Runtime architecture research loop and delivery workflow'
doc.core_properties.author = 'CyberMorph'
for root in [doc.styles.element, doc._element]:
    for border in list(root.iter(qn('w:pBdr'))):
        border.getparent().remove(border)
doc.save(out / 'CyberMorph System Architecture.docx')
print(out / 'CyberMorph System Architecture.docx')
