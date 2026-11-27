import type { AgentToRendererMessage } from "@a2ui/web_core/v1_0"

import { DIGITAL_AGENCY_CATALOG_ID } from "@/lib/a2ui/catalog"

/** Fixed agent response, intentionally usable without an LLM or API key. */
export const applicationMessages: AgentToRendererMessage[] = [
  {
    version: "1.0",
    createSurface: {
      surfaceId: "application",
      catalogId: DIGITAL_AGENCY_CATALOG_ID,
    },
  },
  {
    version: "1.0",
    updateDataModel: {
      surfaceId: "application",
      path: "/",
      value: {
        name: "",
        details: "",
        agree: false,
        status: "入力内容はこのブラウザ内だけで扱います。",
      },
    },
  },
  {
    version: "1.0",
    updateComponents: {
      surfaceId: "application",
      components: [
        {
          id: "root",
          component: "Column",
          children: [
            "title",
            "description",
            "name",
            "details",
            "agree",
            "divider",
            "status",
            "submit",
          ],
        },
        { id: "title", component: "Heading", text: "オンライン申請の体験" },
        {
          id: "description",
          component: "Text",
          text: "氏名と相談内容を入力し、同意してから確認してください。実際の申請は送信されません。",
        },
        {
          id: "name",
          component: "Input",
          label: "氏名",
          required: true,
          value: { "@path": "/name" },
        },
        {
          id: "details",
          component: "Textarea",
          label: "相談内容",
          value: { "@path": "/details" },
        },
        {
          id: "agree",
          component: "Checkbox",
          label: "入力内容の確認に同意します",
          value: { "@path": "/agree" },
        },
        { id: "divider", component: "Divider" },
        { id: "status", component: "Text", text: { "@path": "/status" } },
        {
          id: "submit",
          component: "Button",
          label: "入力内容を確認",
          action: {
            event: {
              name: "confirm_application",
              context: {
                name: { "@path": "/name" },
                details: { "@path": "/details" },
                agree: { "@path": "/agree" },
              },
            },
          },
        },
      ],
    },
  },
]
