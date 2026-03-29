
DO $$
DECLARE
  v_user_id uuid;
  v_sop1 uuid := gen_random_uuid();
  v_sop2 uuid := gen_random_uuid();
  v_sop3 uuid := gen_random_uuid();
  v_sop4 uuid := gen_random_uuid();
  v_sop5 uuid := gen_random_uuid();
  v_sop6 uuid := gen_random_uuid();
  v_sop7 uuid := gen_random_uuid();
  v_sop8 uuid := gen_random_uuid();
  v_sop9 uuid := gen_random_uuid();
  v_sop10 uuid := gen_random_uuid();
  v_cl1 uuid := gen_random_uuid();
  v_cl2 uuid := gen_random_uuid();
  v_cl3 uuid := gen_random_uuid();
  v_cl4 uuid := gen_random_uuid();
  v_cl5 uuid := gen_random_uuid();
  v_tp1 uuid := gen_random_uuid();
  v_tp2 uuid := gen_random_uuid();
  v_tp3 uuid := gen_random_uuid();
  v_tp4 uuid := gen_random_uuid();
  v_tp5 uuid := gen_random_uuid();
  v_tp6 uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  -- SOPs
  INSERT INTO public.sops (id,created_by,title,description,category,department,tags,status,version) VALUES
  (v_sop1,v_user_id,'Machine Overview & Specifications — Barudan BEKY-1501-6','Complete machine identification, component locations, and stitch type reference.','Setup','Embroidery',ARRAY['barudan','machine','specifications'],'published',1),
  (v_sop2,v_user_id,'Daily Startup & Shutdown Procedures','Pre-startup safety check, startup sequence, and end-of-day shutdown.','Setup','Embroidery',ARRAY['barudan','startup','shutdown','daily'],'published',1),
  (v_sop3,v_user_id,'Design Loading & BOX-A Control Panel','Transfer designs via USB, BOX-A panel functions, and setting design origin.','Production','Embroidery',ARRAY['barudan','box-a','design','usb'],'published',1),
  (v_sop4,v_user_id,'Threading the Barudan — Upper Thread, Bobbin & Tension','Upper thread path, bobbin installation, and tension troubleshooting.','Setup','Embroidery',ARRAY['barudan','threading','bobbin','tension'],'published',1),
  (v_sop5,v_user_id,'Hooping Procedures — Selection, Stabilizer & Technique','Hoop selection, stabilizer selection, standard hooping, cap hooping, and mounting.','Production','Embroidery',ARRAY['barudan','hooping','stabilizer','caps'],'published',1),
  (v_sop6,v_user_id,'Production Run Procedures','First article sew-out, production checklist, monitoring, color changes, ending a job.','Production','Embroidery',ARRAY['barudan','production','sew-out','quality'],'published',1),
  (v_sop7,v_user_id,'Embroidery Troubleshooting Guide','Thread breaks, stitch quality, machine errors, needle replacement, when to call service.','Quality Control','Embroidery',ARRAY['barudan','troubleshooting','thread-break','errors'],'published',1),
  (v_sop8,v_user_id,'Barudan Preventive Maintenance Schedule','Daily, weekly, monthly, and annual maintenance procedures and oil points.','Maintenance','Embroidery',ARRAY['barudan','maintenance','oil','cleaning'],'published',1),
  (v_sop9,v_user_id,'Wilcom ES4 — Thread Color Workflow','Editing thread colors, arranging sequences, mapping to needles, exporting, thread library.','Production','Embroidery',ARRAY['wilcom','es4','thread','color','software'],'published',1),
  (v_sop10,v_user_id,'Embroidery Quick Reference Cards','Daily startup checklist, thread break recovery, speed reference, needle sizes, emergency.','General','Embroidery',ARRAY['barudan','quick-reference','speed','needle','emergency'],'published',1);

  -- SOP Steps
  INSERT INTO public.sop_steps (sop_id,sort_order,title,content,tip,warning) VALUES
  (v_sop1,1,'Machine Identification','Manufacturer: Barudan Co., Ltd. Model: BEKY-1501-6 (2022). Single head, 15 needles. Needle type: DBxK5 (system 134-35). Max embroidery area: 400mm x 500mm. Max speed: 1,200 SPM. Recommended: 600–900 SPM. Thread: 40wt polyester or rayon. Bobbin: Class 15 (L-style). Power: 110V/60Hz. USB. BOX-A touchscreen.',NULL,NULL),
  (v_sop1,2,'Machine Zones & Components','NEEDLE BAR: 15 needles, 1–15 left to right. PRESSER FOOT: Holds fabric, adjustable. TAKE-UP LEVER: Above needle bar. TENSION DISCS: Thread stand tower. ROTARY HOOK: Below needle plate. NEEDLE PLATE: Under presser foot. FRAME DRIVE ARMS: Connect to hoop. BOX-A: Right-side touchscreen. THREAD BREAK SENSORS: Optical per thread. CUTTER: Under needle plate.',NULL,NULL),
  (v_sop1,3,'Stitch Types','Running: Outlines, details, underlay. Satin: Lettering, borders, narrow fills. Fill/Tatami: Large areas, backgrounds. Cross Stitch: Decorative. Bean: Bold outlines, reinforcement.',NULL,NULL),
  (v_sop2,1,'Pre-Startup Safety Check','1. Inspect needle bar area — no loose thread/debris. 2. Check 15 needles straight, no burrs. 3. Presser foot UP. 4. Hoop NOT mounted. 5. Bobbin area clear. 6. Work area clear of tools.',NULL,'Never start without completing this checklist. Missed steps cause broken needles, thread jams, or damage to customer goods.'),
  (v_sop2,2,'Machine Startup Sequence','1. Power on main switch (rear) — initializes. 2. Wait for BOX-A boot (~30s). 3. Needle position check — don''t touch. 4. Press ORIGIN. 5. Jog each color 1–2 stitches to confirm thread. 6. Check bobbin level. 7. Load/confirm design.',NULL,NULL),
  (v_sop2,3,'End-of-Day Shutdown','1. Complete/cancel current job. 2. Return frame HOME. 3. Remove hooped garments. 4. Lower presser foot. 5. Wipe needle plate with lint-free cloth. 6. Oil rotary hook (1 drop). 7. Power OFF BOX-A then main switch. 8. Cover machine. 9. Log issues.',NULL,NULL),
  (v_sop3,1,'Transferring Designs','Designs must be .DST or .FDR format. 1. Save from Wilcom as .DST to USB. 2. Insert USB. 3. MENU > DESIGN > READ FROM USB. 4. Select file, press ENTER. 5. Machine copies to internal memory. 6. Confirm in selection window.','Name files clearly: CustomerName_DesignName_ColorCount.DST',NULL),
  (v_sop3,2,'BOX-A Key Functions','START/STOP, ORIGIN, FRAME HOME, COLOR CHANGE, SPEED +/-, TRACE (verify placement without stitching), NEEDLE SELECT, THREAD BREAK RESET, BACK STITCH, DESIGN MENU.',NULL,NULL),
  (v_sop3,3,'Setting Design Origin','1. Mount hooped garment. 2. Use joystick to position needle over center. 3. Press SET ORIGIN. 4. Press TRACE to verify boundary. 5. START only after trace confirms.',NULL,'Always TRACE before production. Misaligned origin wastes garments. On customer-supplied items, one mistake may be uncorrectable.'),
  (v_sop4,1,'Upper Thread Path','1. Cone on stand, unwinds from top. 2. Thread guide bar. 3. Upper guide post. 4. Tension disc (snug grip). 5. Take-up spring guide. 6. Take-up lever (left-to-right). 7. Lower guides on needle bar. 8. Needle front-to-back. 9. Pull 3–4" tail.','Color code cone stand positions to match Wilcom sequence. Label pegs 1–15.',NULL),
  (v_sop4,2,'Bobbin Threading','1. Use pre-wound Class 15 bobbins (recommended). 2. Insert so thread unwinds counter-clockwise. 3. Route through slot, under tension spring. 4. Pull 3–4" tail. 5. Insert into rotary hook — clicks when seated. 6. Leave tail hanging free.',NULL,'NEVER force the bobbin case. If it doesn''t click, something is misaligned. Forcing damages the hook basket.'),
  (v_sop4,3,'Thread Tension Guide','Loops on top: Upper too loose → tighten disc or loosen bobbin screw. Loops underneath: Upper too tight → loosen 1/4 turn. Frequent breaks: Tension or snag → check path, lower tension. Puckering: Both tight → reduce. Skipped stitches: Dull needle → replace, verify DBxK5.',NULL,NULL),
  (v_sop5,1,'Why Hooping Matters','Proper hooping is the single most important variable in embroidery quality. Poor hooping causes misregistration, puckering, poor stitch quality, and wasted goods.',NULL,NULL),
  (v_sop5,2,'Hoop Selection','Round 4": Pocket logos, hat patches. Round 6": Medium chest logos. Oval 8x12": Large chest/back. Tubular 4x4"–6x10": T-shirts, polos. Cap Frame: Structured caps. Sash 2x10"/2x12": Sleeve stripes. Magnetic: Delicate/stretch fabrics. Rule: smallest hoop with 1/2" clearance.',NULL,NULL),
  (v_sop5,3,'Stabilizer Selection','Cut-Away woven: Knits, stretchy — permanent. Cut-Away non-woven: T-shirts, light knits. Tear-Away: Woven fabrics (denim, canvas). Tear-Away Medium: Carhartt, workwear. Topping: Fleece, terry, polo — ON TOP. Adhesive: Items that can''t be hooped.','Carhartt: use 2 layers medium cut-away — heavy fabric shifts without adequate backing.',NULL),
  (v_sop5,4,'Standard Hooping (T-Shirts & Polos)','1. Select stabilizer. 2. Cut 1–2" larger than hoop. 3. Separate rings. 4. Stabilizer flat on table. 5. Garment face-down, aligned. 6. Outer ring under. 7. Inner ring DOWN into outer. 8. Drum-tight, no wrinkles. 9. Verify straight grain. 10. Tighten just past hand-tight.',NULL,'Never hoop over seams. Causes puckering and registration errors.'),
  (v_sop5,5,'Cap Hooping','1. Install cap frame driver. 2. Select cap insert (structured vs. unstructured). 3. Slide cap on — bill away from machine. 4. Smooth across front panel. 5. Center guide to cap seam. 6. Max 2.5" height. 7. Speed 600–700 SPM.','Structured caps: tear-away inside optional but helps. Unstructured always need stabilizer.',NULL),
  (v_sop5,6,'Mounting Hoop','1. Machine at ORIGIN, presser foot UP. 2. Frame arms forward. 3. Slide hoop tabs into receivers — click. 4. Confirm level. 5. TRACE to verify.',NULL,NULL),
  (v_sop6,1,'First Article Protocol','Every design needs approved sew-out before production. 1. Load design per job ticket. 2. Hoop comparable fabric. 3. Run complete design at production speed. 4. Evaluate colors, registration, puckering, birdnesting. 5. Measure against artwork. 6. If approved, document and begin. 7. If not, correct in Wilcom.',NULL,'Never skip first article. Running 200 Carhartts on a bad sew-out is a disaster.'),
  (v_sop6,2,'Production Run Checklist','• Job ticket at machine. • Design loaded, sequence verified. • Thread colors on correct needles. • Bobbin adequate. • Stabilizer staged. • Garments sorted by size. • First article approved.',NULL,NULL),
  (v_sop6,3,'During-Run Monitoring','Stay within hearing range. Watch for: thread break lights, unusual sounds, bobbin showing through, registration drift (check every 5th piece), stabilizer integrity.',NULL,NULL),
  (v_sop6,4,'Color Change Protocol','1. Machine stops — BOX-A shows next color. 2. Confirm thread matches plan. 3. If correct: START. 4. If wrong: NEEDLE SELECT to override. 5. Trim jump threads if needed.',NULL,NULL),
  (v_sop6,5,'Ending a Job','1. Machine returns to home. 2. Remove hoop. 3. Remove garment carefully. 4. Trim cut-away with curved scissors. 5. Tear tear-away in weave direction. 6. Remove topping if used. 7. Inspect: all tails trimmed, no skips. 8. Log quantity on job ticket.',NULL,NULL),
  (v_sop7,1,'Thread Break Issues','Frequent upper: tension/snag/small needle → re-thread, try larger needle. At eye: burr/wrong type → replace, confirm DBxK5. One color only: bad thread → fresh cone. Bobbin: tension/seating → reinsert, check spring. At start: short tail → 3-4" tail, hold first 5 stitches.',NULL,NULL),
  (v_sop7,2,'Stitch Quality Issues','Skipped: dull needle/timing → replace first. Puckering: tension/stabilizer → reduce, add layer. Misregistration: hoop shifted → re-hoop. Loops top: bobbin tight → loosen 1/8 turn. Loops bottom: upper loose → tighten. Birdnesting: re-thread completely. Uneven satin: replace needle, add underlay.',NULL,NULL),
  (v_sop7,3,'Machine Errors','THREAD BREAK: re-thread, reset, resume. BOBBIN BREAK: replace/reinsert, reset. FRAME LIMIT: re-home, check design vs hoop. NEEDLE POSITION: manual position function. COMMUNICATION: quality USB drives. E-STOP: clear obstruction, release, re-home.',NULL,NULL),
  (v_sop7,4,'Needle Replacement','1. Power off or raise needle bar. 2. Loosen clamp screw. 3. Slide needle out. 4. Insert new — flat side toward hook. 5. Push ALL THE WAY up. 6. Tighten firmly. 7. Re-thread and test 10–20 stitches.',NULL,'Turn off machine before replacing needles. Needle bar can move unexpectedly.'),
  (v_sop7,5,'When to Call Service','• Hook timing issues after needle replacement. • Repeating frame errors. • Grinding/knocking noises. • Trimmer malfunction. • Persistent error codes. • BOX-A freezes.','Post service number at machine. Document error code, what machine was doing, and garment type.',NULL),
  (v_sop8,1,'Maintenance Overview','Consistent preventive maintenance = 20-year machine life. Do not skip or defer.',NULL,NULL),
  (v_sop8,2,'Daily Maintenance','• Clean needle plate with brush/air. • Clean bobbin area. • Oil rotary hook (1 drop). • Check needle tips. • Wipe exterior. • Log hours and issues.',NULL,NULL),
  (v_sop8,3,'Weekly Maintenance','• Deep clean hook race with isopropyl. • Oil all designated points. • Clean tension disc guides. • Inspect needle bar connections. • Check frame arm connections. • Test thread trimmer.',NULL,NULL),
  (v_sop8,4,'Monthly Maintenance','• Oil secondary points (frame drive, arm bearings). • Clean take-up lever pivot. • Check hook timing on test fabric. • Inspect drive belts. • Inspect bobbin cases. • Check BOX-A firmware.',NULL,NULL),
  (v_sop8,5,'Annual Service','• Professional hook timing calibration. • Full drive system inspection. • Complete lubrication service. • Thread trimmer blade replacement. • Electrical inspection. • BOX-A calibration.',NULL,NULL),
  (v_sop8,6,'Oil Points','• Rotary hook outer race — 1 drop daily. • Inner race — 1 drop weekly. • Needle bar bushing — 1 drop weekly. • Take-up lever pivot — 1 drop monthly.',NULL,'Use ONLY embroidery machine oil. Never WD-40 or petroleum-based lubricants. Contamination damages machine and stains garments.'),
  (v_sop9,1,'Opening Design & Color Palette','1. Open Wilcom ES4, open design. 2. Color Palette at bottom = color stops. 3. Sequence Panel (F9) = full sequence order. 4. Each stop has thread brand/number — must match machine.',NULL,NULL),
  (v_sop9,2,'Editing Thread Colors','Method 1: Click palette swatch → Color Properties → select brand/number → Assign. Method 2: Select objects → Properties → Fill/Outline tab → Thread Selector → OK.','Hold Shift + click multiple objects to recolor a group in one step.',NULL),
  (v_sop9,3,'Reordering Color Stops','Sequence Panel (F9): drag to reorder. Verify overlap. Watch stitch order dependencies. Merge duplicates: right-click → Merge Color Stop. Review order after merge.',NULL,NULL),
  (v_sop9,4,'Mapping Colors to Needles','1. Count stops in Sequence Panel. 2. Map on job ticket: Stop 1 = Needle #X. 3. Load correct thread per needle. 4. Label with brand/number. 5. Visual verify against Wilcom.',NULL,NULL),
  (v_sop9,5,'Exporting for Barudan','1. File > Save As/Export. 2. Select .DST (Tajima). 3. Confirm Start Point, Trims, Color Changes. 4. Save to USB. 5. Keep original .EMB separately.',NULL,NULL),
  (v_sop9,6,'Thread Library','Tools > Thread Library Manager → select/create brand → Add Thread (number, name, RGB) → Save.',NULL,NULL),
  (v_sop9,7,'Preview Before Output','View > 3D Simulation → step through each color stop → verify correct elements → check layering order.',NULL,NULL),
  (v_sop10,1,'60-Second Startup','Power on → BOX-A boot → ORIGIN → check bobbin → check 15 thread paths → load design → mount hoop → SET ORIGIN → TRACE → START.',NULL,NULL),
  (v_sop10,2,'Thread Break Recovery','1. Note needle (BOX-A). 2. Re-thread from cone (don''t re-tie). 3. Pull 3–4" tail. 4. THREAD BREAK RESET. 5. START — backs up and resumes.',NULL,NULL),
  (v_sop10,3,'Speed Reference','Knits/T-shirts: 800–900. Wovens/Carhartt: 700–800. Caps: 600–700. Dense/fine detail: 600–700. First article: 600. Fleece: 500–600 SPM.',NULL,NULL),
  (v_sop10,4,'Needle Sizes','#70/10 60wt: Sheer, fine detail. #75/11 40–60wt: Standard knits, polos. #80/12 40wt: Most production. #90/14 40wt heavy/30wt: Denim, Carhartt.',NULL,NULL),
  (v_sop10,5,'Emergency Escalation','Can''t resolve error: stop, document, contact Phil. Design quality issue: do NOT run, flag ticket, contact Phil/Travis. Garment damaged: stop, set aside, contact Phil. Low on thread: contact Phil before running out. Service needed: log, contact Barudan dealer.',NULL,NULL);

  -- Checklists
  INSERT INTO public.checklist_templates (id,created_by,title,description,category,department,items) VALUES
  (v_cl1,v_user_id,'Embroidery Daily Maintenance Checklist','Complete every operating day.','Maintenance','Embroidery','[{"text":"Clean lint from needle plate area","required":true},{"text":"Clean bobbin area — blow out lint","required":true},{"text":"Apply 1 drop oil to rotary hook groove","required":true},{"text":"Check needle tips — replace dull/bent","required":true},{"text":"Wipe down machine exterior","required":false},{"text":"Log machine hours and issues","required":true}]'),
  (v_cl2,v_user_id,'Embroidery Weekly Maintenance Checklist','Complete every Friday.','Maintenance','Embroidery','[{"text":"Deep clean hook race area","required":true},{"text":"Oil all designated points","required":true},{"text":"Clean tension disc guides","required":true},{"text":"Inspect needle bar connections","required":true},{"text":"Check frame drive arm connections","required":true},{"text":"Test thread trimmer on scrap","required":true}]'),
  (v_cl3,v_user_id,'Embroidery Monthly Maintenance Checklist','Complete end of each month.','Maintenance','Embroidery','[{"text":"Oil secondary points (frame drive, arm bearings)","required":true},{"text":"Clean take-up lever pivot","required":true},{"text":"Check hook timing on test fabric","required":true},{"text":"Inspect drive belts for wear","required":true},{"text":"Inspect bobbin cases — replace if worn","required":true},{"text":"Check BOX-A firmware version","required":false}]'),
  (v_cl4,v_user_id,'Embroidery Pre-Startup Safety Checklist','Before every machine startup.','Safety','Embroidery','[{"text":"Inspect needle bar — no loose thread/debris","required":true},{"text":"All 15 needles straight, no burrs","required":true},{"text":"Presser foot in UP position","required":true},{"text":"Hoop/frame NOT mounted","required":true},{"text":"Bobbin area clear — no caught thread","required":true},{"text":"Work area clear of tools/scissors","required":true}]'),
  (v_cl5,v_user_id,'Embroidery Production Run Checklist','Before starting any production run.','Production','Embroidery','[{"text":"Job ticket at machine with all specs","required":true},{"text":"Design loaded, color sequence verified","required":true},{"text":"Thread colors on correct needles","required":true},{"text":"Bobbin has adequate thread","required":true},{"text":"Stabilizer staged and ready","required":true},{"text":"Garments sorted, counted, by size","required":true},{"text":"First article approved on job ticket","required":true}]');

  -- Training Phase Checklists
  INSERT INTO public.checklist_templates (id,created_by,title,description,category,department,items) VALUES
  (v_tp1,v_user_id,'Training Phase 1 — Machine Familiarization (Days 1–3)','Identify components, startup/shutdown, thread all 15 needles.','Onboarding','Embroidery','[{"text":"Identify all 15 needle positions","required":true},{"text":"Name/locate all key components","required":true},{"text":"Complete startup sequence independently","required":true},{"text":"Thread all 15 needles from scratch","required":true},{"text":"Install/remove bobbin case correctly","required":true},{"text":"Complete shutdown sequence independently","required":true},{"text":"Complete daily maintenance checklist","required":true}]'),
  (v_tp2,v_user_id,'Training Phase 2 — Hooping Proficiency (Days 3–7)','Select hoop/stabilizer, hoop garments, mount/dismount.','Onboarding','Embroidery','[{"text":"Select correct hoop for design size (3 scenarios)","required":true},{"text":"Select stabilizer for T-shirt, polo, Carhartt, fleece","required":true},{"text":"Hoop T-shirt: drum-tight, straight grain","required":true},{"text":"Hoop polo with placket management","required":true},{"text":"Hoop structured cap with cap frame","required":true},{"text":"Mount/dismount hoop on machine","required":true},{"text":"Use TRACE on 3 different designs","required":true}]'),
  (v_tp3,v_user_id,'Training Phase 3 — Machine Operation (Days 7–14)','Load designs, set origin, run production, handle errors.','Onboarding','Embroidery','[{"text":"Transfer design from USB to machine","required":true},{"text":"Set origin for chest logo placement","required":true},{"text":"Complete first article sew-out and evaluate","required":true},{"text":"Run 10-piece production run (observed)","required":true},{"text":"Respond to thread break error correctly","required":true},{"text":"Respond to bobbin-out correctly","required":true},{"text":"Replace needle with machine off","required":true},{"text":"Complete job ticket documentation","required":true}]'),
  (v_tp4,v_user_id,'Training Phase 4 — Independent Production (Day 14+)','Run embroidery department independently.','Onboarding','Embroidery','[{"text":"Stage a complete job independently","required":true},{"text":"25-piece run with zero defects","required":true},{"text":"Identify and escalate design quality issue","required":true},{"text":"Complete weekly maintenance (trainer sign-off)","required":true},{"text":"Correct garment finishing technique","required":true},{"text":"Operate at rated production pace","required":true}]'),
  (v_tp5,v_user_id,'Training Phase 5 — Wilcom ES4 (Week 3–4)','Edit colors, arrange sequences, create needle maps.','Onboarding','Embroidery','[{"text":"Open design and identify color palette","required":true},{"text":"Edit thread colors (both methods)","required":true},{"text":"Reorder color stops in Sequence Panel","required":true},{"text":"Merge duplicate color stops","required":true},{"text":"Create color-to-needle map on job ticket","required":true},{"text":"Export .DST for Barudan","required":true},{"text":"Use 3D Simulation to verify","required":true}]');

  -- Training Plan
  INSERT INTO public.training_plans (id,created_by,title,description,role,department,sop_ids,checklist_template_ids) VALUES
  (v_tp6,v_user_id,'Embroidery Operator Onboarding — New Hire Training Program',
  'Structured 4-week training from zero experience to independent production on the Barudan BEKY-1501-6.',
  'Embroidery Operator','Embroidery',
  ARRAY[v_sop1,v_sop2,v_sop3,v_sop4,v_sop5,v_sop6,v_sop7,v_sop8,v_sop9,v_sop10],
  ARRAY[v_cl4,v_cl5,v_cl1,v_cl2,v_cl3,v_tp1,v_tp2,v_tp3,v_tp4,v_tp5]);

END $$;
