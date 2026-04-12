export type SetterValueType =
  | string
  | number
  | boolean
  | null
  | undefined
  | SetterValueType[]
  | { [key: string]: SetterValueType };

export interface ExpressionEvent<
  ExpressionValue,
  FormValue = { [key: string]: SetterValueType }
> {
  value: ExpressionValue;
  formValue: FormValue;
}

export interface Expression<
  ExpressionValue,
  FormValue = { [key: string]: SetterValueType }
> {
  type: "expression";
  value: (ctx: ExpressionEvent<ExpressionValue, FormValue>) => ExpressionValue;
}

export type SetterMaybeExpression<
  ExpressionValue,
  FormValue = { [key: string]: SetterValueType }
> = ExpressionValue | Expression<ExpressionValue, FormValue>;

export interface ValueSetter<
  T extends SetterValueType = SetterValueType,
  FormValue = { [key: string]: SetterValueType }
> {
  type: string;
  defaultValue?: T;
  visible?: SetterMaybeExpression<boolean, FormValue>;
}

export interface ArraySetter<
  T extends SetterValueType = SetterValueType,
  FormValue = { [key: string]: SetterValueType }
> {
  type: "array";
  item: ValueSetter<T, FormValue>;
  visible?: SetterMaybeExpression<boolean, FormValue>;
}

export interface ObjectSetter<
  T extends { [key: string]: SetterValueType } = {
    [key: string]: SetterValueType;
  },
  FormValue = { [key: string]: SetterValueType }
> {
  type: "object";
  properties: {
    [K in keyof T]: ValueSetter<
      T[K] extends SetterValueType ? T[K] : SetterValueType,
      FormValue
    >;
  };
  visible?: SetterMaybeExpression<boolean, FormValue>;
}

export type Setter<
  T extends SetterValueType = SetterValueType,
  FormValue = { [key: string]: SetterValueType }
> =
  | ValueSetter<T, FormValue>
  | ArraySetter<T extends SetterValueType[] ? T[number] : T, FormValue>
  | ObjectSetter<
      T extends { [key: string]: SetterValueType } ? T : never,
      FormValue
    >;

export type FormSchema<
  FormValue extends {
    [key: string]: SetterValueType;
  } = { [key: string]: SetterValueType }
> = {
  [K in keyof FormValue]: ValueSetter<
    FormValue[K] extends SetterValueType ? FormValue[K] : SetterValueType,
    FormValue
  >;
};