"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAdminToken } from "@/components/rekyc/adminApi";

export default function RekycAdminIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getAdminToken() ? "/rekyc-admin/dashboard" : "/rekyc-admin/login");
  }, [router]);
  return null;
}
