import { LANG_ENUM } from "@/consts/common";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import sharedVi from "./vi/shared.json";

export const defaultNS = "shared";

i18next
  .use(initReactI18next)
  .init({
    lng: LANG_ENUM.vi,
    fallbackLng: LANG_ENUM.vi,
    debug: false,
    resources: {
      vi: {
        shared: sharedVi,
      },
    },
    defaultNS,
  });

export default i18next;
