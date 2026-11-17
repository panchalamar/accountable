# Intent: the Accountable MVP

## Problem

A small business keeps track of its customers and sales in spreadsheets, inboxes and people's heads. Nobody can see at a glance which companies we deal with, who our contacts are, what's in the sales pipeline, what happened last with a customer or what needs doing next.

## Proposed outcome

Accountable is a business management system: a sales CRM that will grow into a full Business OS, including ERP. This first version, the MVP, is a complete sales CRM for one person, running on their own computer. Think of it as a private Salesforce that does the everyday CRM essentials really well. It should feel sharp, modern and professional, and be a pleasure to use.

### Five sections

- **Dashboard**, the landing page: how sales are going at a glance. Deals won and revenue won month by month for the last 12 months, ending with the current month, the open pipeline and its expected revenue (each deal's value times its probability of close), a sales funnel showing how much value reaches each stage, recent activity, and follow-ups: the overdue ones first, then those due in the next 7 days. Each follow-up links to its contact or deal and has a checkbox to mark it done right there. The dashboard should be visually stunning, with at least a line chart, a bar chart and a visual of the pipeline. Which figures each one shows, and how, is the designer's call.
- **Organizations**: the companies we do business with. Open one to see its contacts and deals.
- **Contacts**: the people we deal with, including leads and customers, with a filter by status. Open one to see their organization and a timeline of everything that has happened with them.
- **Deals**: the potential sales, with each one's stage, value and close date. Open one to see its details and its timeline. A deal still open after its expected close date stands out, in the table and on its pipeline card.
- **Pipeline**: the deals as cards on a board, one column per stage, all six including Won and Lost. The Won and Lost columns show only deals closed in the last 30 days; older closed deals stay in the Deals table and on the dashboard. Drag a card to another column to change the deal's stage, or within a column to change its place; a card can be dropped anywhere in a column, and it stays where it was dropped. Each card also has a way to change its stage without dragging, such as a stage menu, so the board works by keyboard. A new deal can be added straight into a column, at that stage. The board shows the total value and expected revenue of the deals still open, each column shows its own, and the figures change as soon as a card moves.

Every table has a search box, columns you can sort by clicking their headings, a way to add a new record, and edit and delete on each row. That's how we add a new deal, a new lead or a new customer. Saving a record with a missing or invalid field shows a clear message next to that field. Deleting asks first, and says what will happen to the records linked to the one being deleted. The rules are:

- **Organization**: can't be deleted while it still has contacts or deals. The message says how many, and they have to be deleted or moved first.
- **Contact**: can't be deleted while it is the main contact on a deal. Otherwise it can be. Activities linked only to that contact are deleted with it; activities that are also linked to a deal stay on the deal's timeline. The confirmation says how many of each.
- **Deal**: can be deleted. Activities linked only to that deal are deleted with it; activities that are also linked to a contact stay on the contact's timeline. The confirmation says how many of each.
- **Activity**: can be deleted on its own, with a confirmation.

A contact can be moved to another organization, except while they are the main contact on a deal at their current organization. Then the move is refused, the message lists those deals, and each one needs a different main contact first. This keeps every deal's main contact at the deal's organization. Existing activity links stay as they are when a contact or deal moves to another organization.

From any contact or deal you can log an activity (a note, call or email) and give it a follow-up date. A follow-up shows on the dashboard as a task until it's marked done. Activities can be edited and deleted too. When a deal moves to another stage, including Won or Lost, an entry such as "Moved from Proposal to Negotiation" appears in its timeline and in the dashboard's recent activity by itself. When a deal moves to Won or Lost, or is added straight into one of those columns, its close date is set to today, so a win counts in this month's figures; it can be edited afterwards. A Won or Lost deal can be reopened by moving it back to an open stage. Reopening asks for a new expected close date, 30 days from today by default, so the deal doesn't show as late by accident. Winning a deal doesn't change its contact's status; that is always changed by hand.

### Four kinds of record

- **Organization**: a company we do business with. Name, website, industry and notes. An organization has many contacts and many deals.
- **Contact**: a person we deal with. Name, email, phone, job title, the organization they belong to, and a status (lead, qualified or customer). A lead is a contact with the lead status, so there's no separate list of leads.
- **Deal**: a potential sale. Name, the organization and the main contact it is with, its stage (New, Qualified, Proposal, Negotiation, Won or Lost), its value in US dollars, its probability of close, and its expected or actual close date. The main contact must belong to the deal's organization, so the contact choice only lists that organization's contacts. Each stage has a usual probability of close: New 10%, Qualified 25%, Proposal 50%, Negotiation 75%, Won 100%, Lost 0%. A deal takes its new stage's probability when it moves; a probability set by hand is kept until the stage changes.
- **Activity**: something that happened, or needs to happen, with a contact or deal. Type (note, call or email), a description and when it happened, and optionally a follow-up date and whether it's done. It is linked to a contact, a deal or both:
  - Logged on a contact's page, it is linked to that contact, and can also be linked to one of the deals at the contact's organization.
  - Logged on a deal's page, it is linked to that deal, and can also be linked to one of the contacts at the deal's organization.
  - The second link is always optional and never added automatically. An activity linked to both shows on both timelines.

Required fields and duplicates:

- An organization needs a name, and two organizations can't share a name.
- A contact needs a name and an organization. Email is optional, but must be a valid address and not already used by another contact.
- A deal needs a name, organization, main contact, stage, value (zero or more) and close date.
- An activity needs a type, a description and when it happened.

### Sample data

Accountable comes with realistic sample data, so every screen looks alive the first time it starts. The business sells large B2B contracts, such as manufacturing contracts and enterprise systems: a modest number of long, high-value deals, mostly between $100,000 and $1,000,000. The sample data has organizations across several industries, contacts at every status, deals at every stage (including deals won and lost over the past 12 months, deals expected to close in the months ahead and a few running late), and activities with some follow-ups due soon and some overdue. Some deals were won and some lost in the last 30 days, so those pipeline columns aren't empty, and wins are spread across most of the last 12 months. Every sample date is relative to the day the data is created, so late deals, overdue follow-ups and the charts still look right whenever it's reset.

### Look and feel

The look follows Accountable's brand guidelines, which take priority over any general design guidance. The MVP is light mode, designed for a laptop or desktop screen. It is usable by keyboard alone (apart from changing a card's place within a pipeline column), with a visible focus, text that meets WCAG AA contrast, and a label on every form field.

## Affected users and systems

- One salesperson at a business that sells large B2B contracts, using Accountable on their own computer every day. They aren't technical. The rest of the sales team joins later.
- No other systems are involved yet.

## Constraints

- The technology in `docs/TECH_STACK.md`.
- It runs locally with one documented command that works on Mac, Linux and Windows, and needs no internet connection to use.
- Every change is kept: it's still there after a browser refresh, and every time the app starts it shows every change made before.
- One documented command resets the data to the sample data, to start again from scratch. It asks for confirmation first and saves a timestamped copy of the current database before replacing it. A `--yes` option skips the question, for scripts and tests.
- Built for up to a few hundred records of each kind. Tables load everything and search and sort in the browser, with no pagination. Larger volumes are a later concern.
- Not in the MVP: sign-in, user accounts or several users; a dark mode or a layout for phones; AI features; email, calendar or phone integrations; currencies other than US dollars; reports beyond the dashboard; tags or custom fields; changing the pipeline stages; importing or exporting data.

## Success criteria

1. Someone non-technical can start Accountable with the one documented command, open it in a browser and land on the dashboard, with sample data on every screen.
2. Organizations, contacts (leads, qualified contacts and customers) and deals can each be added, found by searching, sorted, edited and deleted from their tables, and every change is still there after a refresh and after a restart. A missing required field, an invalid email, a duplicate organization name or an email already in use is refused with a clear message.
3. Deleting asks first and follows the delete rules above. An organization with contacts or deals, or a contact who is a deal's main contact, can't be deleted. An activity linked to both a contact and a deal survives deleting either one and stays on the other's timeline. Moving a contact who is a deal's main contact to another organization is refused.
4. Contacts can be filtered by status, and each record's page shows the records it's linked to.
5. Dragging a deal to another column on the pipeline, or changing its stage from the card without dragging, changes its stage and its probability of close, and the deals list shows both. A card dropped anywhere in a column, including higher or lower in its own column, stays there after a refresh. The board's and the columns' totals and expected revenue change as soon as the card moves. A deal added in a column starts at that stage, and late deals stand out. Won and Lost show only deals closed in the last 30 days.
6. Moving a deal to Won or Lost sets its close date to today, and leaves its contact's status alone. Moving it back to an open stage asks for a new expected close date.
7. An activity or follow-up logged on a contact or deal appears in its timeline, newest first, and so does an entry for each change of stage. An activity linked to both a contact and a deal appears on both timelines. Follow-ups show on the dashboard as overdue or due in the next 7 days until they're marked done, and ticking one done on the dashboard removes it.
8. The dashboard's figures match the data, and they reflect a deal marked won (in the current month) or a new follow-up.
9. The reset command asks before replacing the data, keeps a copy of the old database, and brings back the sample data.
10. Every screen is sharp, modern and professional, and follows the brand. The dashboard is visually stunning, with a line chart, a bar chart and a visual of the pipeline.
11. Every screen can be used by keyboard alone, with a visible focus. On the pipeline, a card's stage can be changed from the card without dragging; only changing a card's place within a column needs a mouse. Text meets WCAG AA contrast and every form field has a label.
12. Before it's called done, someone has used it end to end in a real browser, the way a salesperson would: every section and every action above, each screen checked by eye, with no errors in the browser's console. Passing tests is necessary, but it isn't enough.

## Open questions

- Sign-in, several people sharing the same data, and a record of who did what are for a later intent.
- Making Accountable available to people beyond the computer it runs on is for later too.
