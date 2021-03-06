import { File, Text, Indent, IndentationTypes } from '@asyncapi/generator-react-sdk';
import { normalizeSchemaName } from '../helpers/normalizeSchemaName';

const parserSchemaExt = 'x-parser-schema-id';
const enumNamesExt = 'x-enumNames';

export default function({ asyncapi, params }) {
  const schemas = asyncapi.allSchemas();
  // schemas is an instance of the Map
  return Array
    .from(schemas)
    .filter(([schemaName, schema]) => {
      const required = schema.required();
      return !normalizeSchemaName(schemaName).startsWith('anonymous-schema')
      && (required === undefined || !required.some(x => x.startsWith('cloudevent:')));
    }
    )
    .map(([schemaName, schema]) => {
      const name = normalizeSchemaName(schemaName);
      return (
        <File name={`${name}.cs`}>
          <CreateFile schemaName={schemaName} schema={schema} namespace={params.namespace} />
        </File>
      );
    });
}

function CreateFile({schemaName, schema, namespace}) {
  if (schema.hasExtension(enumNamesExt)) return EnumFile(schemaName,schema, namespace);
  return ClassFile(schemaName, schema, namespace);
}

function ClassFile(schemaName, schema, namespace) {
  const propOutput = [];
  const properties = schema.properties();
  for (const propName in properties) {
    // eslint-disable-next-line security/detect-object-injection
    const propObj = properties[propName];
    propOutput.push(
      <Indent size={4} type={IndentationTypes.SPACES}>
        <Text>public {GetType(propObj.type(), propObj.format(), propObj)} {propName} {'{ get; set; }'}</Text>
      </Indent>);
  }
  return (
    <>
      <Text>using System;</Text>
      <Text></Text>
      <Text>namespace {namespace}</Text>
      <Text>{'{'}</Text>
      <Indent size={4} type={IndentationTypes.SPACES}>
        <Text>public class {schemaName}</Text>
        <Text>{'{'}</Text>
        {propOutput}
        <Text>{'}'}</Text>
      </Indent>
      <Text>{'}'}</Text>
    </>
  );
}

function EnumFile(schemaName, schema, namespace) {
  const enumValOutput = [];
  const enumValues = Array.from(schema.enum().values());
  const enumNames = Array.from(schema.extension('x-enumNames').values());
  // eslint-disable-next-line security/detect-object-injection
  const enumEntries = enumNames.map((name, i) => [name, enumValues[i]]);
  for (const [enumName, enumValue] of enumEntries) {
    enumValOutput.push(
      <Indent size={4} type={IndentationTypes.SPACES}>
        <Text>{enumName} = {String(enumValue)},</Text>
      </Indent>);
  }
  return (
    <>
      <Text>namespace {namespace}</Text>
      <Text>{'{'}</Text>
      <Indent size={4} type={IndentationTypes.SPACES}>
        <Text>public enum {schemaName}</Text>
        <Text>{'{'}</Text>
        {enumValOutput}
        <Text>{'}'}</Text>
      </Indent>
      <Text>{'}'}</Text>
    </>
  );
}

function GetType(type, format, schema) {
  if (Array.isArray(type)) {
    const nullableType = type.find(x => x !== 'null');
    // string is also the return type for other types determined by the format property.
    if (nullableType === 'string' && format === undefined) return 'string';

    const realType = GetType(nullableType, format, schema);
    return `${realType}?`;
  }

  if (type === 'integer') {
    if (format === 'int32') return 'int';
    if (format === 'int64') return 'long';
    // It's an enum with a $ref to a component/schema
    if (format === undefined) return schema.extension(parserSchemaExt);
  }

  if (type === 'boolean') return 'bool';
  if (type === 'string') {
    if (format === undefined) return 'string';
    if (format === 'date-time') return 'DateTime';
    if (format === 'guid') return 'Guid';
  }

  // It's a nested object with a $ref to a component/schema
  if (type === undefined) {
    const oneOfResult = schema.oneOf();
    if (Array.isArray(oneOfResult) && oneOfResult.length > 0) {
      const firstNonNullSchema = oneOfResult.filter(x => x.type() !== 'null')[0];
      return firstNonNullSchema.extension(parserSchemaExt);
    }
    return schema.extension(parserSchemaExt);
  }
  return 'object';
}
