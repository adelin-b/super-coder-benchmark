// Reference implementation for WEB-TS-6: Type-Inferred Props from CustomSetterRender
// Adapted from Web-Bench TypeScript project task 17 (Apache 2.0)

export type SetterValueType =
  | string
  | number
  | boolean
  | SetterValueType[]
  | { [key: string]: SetterValueType }

type FC<P = {}> = (props: P) => any

export type CustomSetterRender<ValueType extends SetterValueType, Props> = {
  render: FC<Props & { value: ValueType; onChange: (value: ValueType) => void }>
}

export interface InputSetter { type: 'input'; value?: string }
export interface NumberSetter { type: 'number'; value?: number }
export interface CheckboxSetter { type: 'checkbox'; value?: boolean }

export interface ArraySetter<
  Value extends SetterValueType[] = SetterValueType[],
  CustomSetterRenderDef extends { [key: string]: CustomSetterRender<any, any> } = {},
  CustomType extends keyof CustomSetterRenderDef = keyof CustomSetterRenderDef,
> {
  type: 'array'
  item: ValueSetter<Value[number], CustomSetterRenderDef, CustomType>
  value?: Value
}

export interface ObjectSetter<
  Value extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
  CustomSetterRenderDef extends { [key: string]: CustomSetterRender<any, any> } = {},
  CustomType extends keyof CustomSetterRenderDef = keyof CustomSetterRenderDef,
> {
  type: 'object'
  properties: {
    [K in keyof Value]: ValueSetter<Value[K], CustomSetterRenderDef, CustomType>
  }
  value?: Value
}

export interface CustomSetter<
  ValueType extends SetterValueType = SetterValueType,
  CustomSetterRenderDef extends { [key: string]: CustomSetterRender<any, any> } = {},
  CustomType extends keyof CustomSetterRenderDef = string,
> {
  type: 'custom'
  customType: CustomType
  value?: ValueType
  props?: Omit<Parameters<CustomSetterRenderDef[CustomType]['render']>[0], 'value' | 'onChange'>
}

export type ValueSetter<
  T extends SetterValueType = SetterValueType,
  CustomSetterRenderDef extends { [key: string]: CustomSetterRender<any, any> } = {},
  CustomType extends keyof CustomSetterRenderDef = keyof CustomSetterRenderDef,
> = T extends string
  ? InputSetter | CustomSetter<T, CustomSetterRenderDef, CustomType>
  : T extends number
    ? NumberSetter | CustomSetter<T, CustomSetterRenderDef, CustomType>
    : T extends boolean
      ? CheckboxSetter | CustomSetter<T, CustomSetterRenderDef, CustomType>
      : T extends SetterValueType[]
        ? ArraySetter<T, CustomSetterRenderDef, CustomType> | CustomSetter<T, CustomSetterRenderDef, CustomType>
        : T extends { [key: string]: SetterValueType }
          ? ObjectSetter<T, CustomSetterRenderDef, CustomType> | CustomSetter<T, CustomSetterRenderDef, CustomType>
          : CustomSetter<T, CustomSetterRenderDef, CustomType>

export interface FormSchema<
  T extends { [key: string]: SetterValueType },
  CustomSetterRenderDef extends { [key: string]: CustomSetterRender<any, any> } = {},
> {
  fields: ValueSetter<T, CustomSetterRenderDef, keyof CustomSetterRenderDef>
  customSetterRenderDefinitions?: CustomSetterRenderDef
}
