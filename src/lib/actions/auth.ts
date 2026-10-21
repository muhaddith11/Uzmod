'use server'

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function register(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const orgName = formData.get("orgName") as string;
  const name = formData.get("name") as string;

  if (!email || !password || !orgName || !name) {
    throw new Error("Barcha maydonlarni to'ldiring");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new Error("Email manzil noto'g'ri formatda")
  }

  if (password.length < 6) {
    throw new Error("Parol kamida 6 ta belgidan iborat bo'lishi kerak")
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: orgName,
        },
      });

      await tx.user.create({
        data: {
          email,
          name,
          passwordHash: hashedPassword,
          organizationId: organization.id,
          role: "ADMIN",
        },
      });

      // Default ombor yaratish
      await tx.warehouse.create({
        data: {
          name: "Asosiy Ombor",
          organizationId: organization.id,
        }
      });
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error("Ushbu email bilan foydalanuvchi mavjud");
    }
    throw error;
  }

  redirect("/login");
}
