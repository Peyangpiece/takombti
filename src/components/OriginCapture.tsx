"use client";
// どこから来たか（流入元）を、ページを開いたときに端末に覚えておく（仕様書 §11.11）。
// 診断を作ったときと回答を送ったときに、決まった値の 1 つとしてだけ送る
import { useEffect } from "react";
import { captureOrigin } from "@/lib/track";

export function OriginCapture() {
  useEffect(() => {
    captureOrigin();
  }, []);
  return null;
}
