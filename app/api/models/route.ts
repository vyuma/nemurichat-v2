import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const modelsDirectory = path.join(process.cwd(), 'public/models');
  try {
    const filenames = fs.readdirSync(modelsDirectory);
    const vrmFiles = filenames.filter(file => file.endsWith('.vrm')).map(file => `/models/${file}`);
    return NextResponse.json(vrmFiles);
  } catch (error) {
    console.error('Error reading models directory:', error);
    return NextResponse.json({ error: 'Failed to read models directory' }, { status: 500 });
  }
}
