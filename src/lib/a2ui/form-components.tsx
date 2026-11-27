import { createComponentImplementation as define } from "@a2ui/react"
import {
  ActionSchema,
  DynamicStringSchema,
  DynamicBooleanSchema,
} from "@a2ui/web_core/v1_0"
import { useId } from "react"
import { z } from "zod"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { SwitchOnOff } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  SearchBox,
  SearchBoxFields,
  SearchBoxInput,
  SearchBoxSubmit,
} from "@/components/ui/search-box"
import {
  HamburgerMenuButton,
  HamburgerIcon,
  CloseIcon,
} from "@/components/ui/hamburger-menu-button"
import {
  FileUpload,
  FileUploadInput,
  FileUploadFileList,
  FileUploadFileItem,
  FileUploadFileName,
  FileUploadFileMeta,
  formatSize,
} from "@/components/ui/file-upload"
import { Button } from "@/components/ui/button"
import { optionsSchema } from "./shared"
const DaRadioGroup = define(
  {
    name: "RadioGroup",
    schema: z.object({
      label: DynamicStringSchema,
      value: DynamicStringSchema,
      disabled: DynamicBooleanSchema.optional(),
      options: optionsSchema,
    }),
  },
  ({ props }) => {
    const id = useId()
    return (
      <fieldset>
        <legend>{props.label}</legend>
        <RadioGroup
          value={props.value ?? ""}
          onValueChange={props.setValue}
          disabled={props.disabled}
        >
          {props.options.map((option, i) => (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroupItem id={`${id}-${i}`} value={option.value} />
              <Label htmlFor={`${id}-${i}`}>{option.label}</Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>
    )
  }
)
const DaSwitch = define(
  {
    name: "Switch",
    schema: z.object({
      label: DynamicStringSchema,
      value: DynamicBooleanSchema,
      disabled: DynamicBooleanSchema.optional(),
    }),
  },
  ({ props }) => {
    const id = useId()
    return (
      <div className="flex items-center gap-3">
        <SwitchOnOff
          id={id}
          type="button"
          aria-checked={props.value ?? false}
          disabled={props.disabled}
          onClick={() => props.setValue(!props.value)}
        />
        <Label htmlFor={id}>{props.label}</Label>
      </div>
    )
  }
)
const DaSearchBox = define(
  {
    name: "SearchBox",
    schema: z.object({
      label: DynamicStringSchema,
      value: DynamicStringSchema,
      action: ActionSchema,
      disabled: DynamicBooleanSchema.optional(),
    }),
  },
  ({ props }) => (
    <SearchBox>
      <SearchBoxFields>
        <SearchBoxInput
          label={props.label}
          type="search"
          value={props.value ?? ""}
          disabled={props.disabled}
          onChange={(e) => props.setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void props.action()
            }
          }}
        />
      </SearchBoxFields>
      <SearchBoxSubmit
        type="button"
        disabled={props.disabled}
        onClick={() => void props.action()}
      >
        検索
      </SearchBoxSubmit>
    </SearchBox>
  )
)
const DaHamburgerMenuButton = define(
  {
    name: "HamburgerMenuButton",
    schema: z.object({
      label: DynamicStringSchema,
      value: DynamicBooleanSchema,
      disabled: DynamicBooleanSchema.optional(),
      children: z.array(z.string()).default([]),
    }),
  },
  ({ props, buildChild }) => (
    <div>
      <HamburgerMenuButton
        type="button"
        aria-expanded={props.value ?? false}
        disabled={props.disabled}
        onClick={() => props.setValue(!props.value)}
      >
        {props.value ? <CloseIcon /> : <HamburgerIcon />}
        {props.label}
      </HamburgerMenuButton>
      {props.value &&
        props.children.map((id) => <div key={id}>{buildChild(id)}</div>)}
    </div>
  )
)
const fileMetadata = z
  .array(
    z.object({
      name: z.string(),
      size: z.number().nonnegative(),
      type: z.string(),
    })
  )
  .max(10)
function fileList(value: string) {
  try {
    return fileMetadata.parse(JSON.parse(value))
  } catch {
    return []
  }
}
const DaFileUpload = define(
  {
    name: "FileUpload",
    schema: z.object({
      label: DynamicStringSchema,
      value: DynamicStringSchema,
      disabled: DynamicBooleanSchema.optional(),
      accept: z.string().optional(),
      multiple: z.boolean().default(false),
    }),
  },
  ({ props }) => {
    const id = useId()
    const files = fileList(props.value ?? "")
    return (
      <FileUpload maxFiles={props.multiple ? 10 : 1}>
        <Label htmlFor={id}>{props.label}</Label>
        <p>
          ファイルの内容は送信しません。選択したファイル名・サイズ・種類を画面データに保持します。
        </p>
        <FileUploadInput
          id={id}
          disabled={props.disabled}
          accept={props.accept}
          multiple={props.multiple}
          onChange={(e) => {
            props.setValue(
              JSON.stringify(
                Array.from(e.target.files ?? [])
                  .slice(0, props.multiple ? 10 : 1)
                  .map((f) => ({ name: f.name, size: f.size, type: f.type }))
              )
            )
            e.target.value = ""
          }}
        />
        <Button
          type="button"
          disabled={props.disabled}
          onClick={() => document.getElementById(id)?.click()}
        >
          ファイルを選択
        </Button>
        <FileUploadFileList>
          {files.map((file, i) => (
            <FileUploadFileItem key={i}>
              <FileUploadFileName>{file.name}</FileUploadFileName>
              <FileUploadFileMeta>{formatSize(file.size)}</FileUploadFileMeta>
              <Button
                type="button"
                variant="text"
                disabled={props.disabled}
                aria-label={`${file.name}を削除`}
                onClick={() =>
                  props.setValue(
                    JSON.stringify(files.filter((_, index) => index !== i))
                  )
                }
              >
                削除
              </Button>
            </FileUploadFileItem>
          ))}
        </FileUploadFileList>
      </FileUpload>
    )
  }
)
export const formComponents = [
  DaRadioGroup,
  DaSwitch,
  DaSearchBox,
  DaHamburgerMenuButton,
  DaFileUpload,
]
