import { db } from './index.js';
import { user, category } from './schema/index.js';
import { eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';

const defaultCategories = [
  { name: 'Alimentação', icon: '🍔', color: '#EF4444' },
  { name: 'Transporte', icon: '🚌', color: '#3B82F6' },
  { name: 'Moradia', icon: '🏠', color: '#8B5CF6' },
  { name: 'Saúde', icon: '🏥', color: '#EC4899' },
  { name: 'Educação', icon: '📚', color: '#06B6D4' },
  { name: 'Lazer', icon: '🎮', color: '#F59E0B' },
  { name: 'Assinaturas', icon: '📱', color: '#84CC16' },
  { name: 'Compras', icon: '🛍️', color: '#F97316' },
  { name: 'Serviços', icon: '🔧', color: '#6366F1' },
  { name: 'Contas', icon: '📄', color: '#14B8A6' },
  { name: 'Dívidas', icon: '💳', color: '#DC2626' },
  { name: 'Outros', icon: '📦', color: '#6B7280' },
];

async function seed() {
  console.log('Seeding database...');

  // Create a demo user if none exists
  const existingUser = await db.select().from(user).limit(1);
  
  let demoUserId: string;
  if (existingUser.length === 0) {
    const passwordHash = await hash('demo123456', {
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      outputLen: 32,
    });

    const [demoUser] = await db.insert(user).values({
      email: 'demo@oxedindin.com',
      passwordHash,
      name: 'Demo User',
      emailVerified: true,
      settings: { theme: 'system' },
    }).returning();

    demoUserId = demoUser.id;
    console.log('Created demo user:', demoUser.email);
  } else {
    demoUserId = existingUser[0].id;
    console.log('Demo user already exists:', existingUser[0].email);
  }

  // Create default categories for the demo user
  const existingCategories = await db.select().from(category).where(eq(category.userId, demoUserId));
  
  if (existingCategories.length === 0) {
    await db.insert(category).values(
      defaultCategories.map((c) => ({
        ...c,
        userId: demoUserId,
        isDefault: true,
      }))
    );
    console.log('Created default categories');
  } else {
    console.log('Default categories already exist');
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});