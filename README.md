# Tank Gallery

A personal photo gallery for tanks, aircraft, artillery, and military vehicles I've photographed at museums around the world.

**Live:** [tank-gallery.vercel.app](https://tank-gallery.vercel.app)

## Features

- Dark, responsive masonry grid with filters by era, type, and nation
- Full-screen lightbox with keyboard navigation
- Search across vehicle names
- Country flag indicators on every card
- AI-powered vehicle classification on upload (Groq / Llama 4 Scout)
- Admin panel with drag-and-drop bulk upload
- Interactive world map of photo locations
- Collection statistics page
- Public "Identify My Tank" tool

## Built with

Next.js · Supabase · Tailwind CSS · Framer Motion · Vercel

## Setup

```bash
git clone https://github.com/berezucc/tank-gallery.git
cd tank-gallery
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                   # http://localhost:3000
```

See `.env.example` for the required API keys (Supabase + Groq).
