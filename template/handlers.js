import { File, Text, Indent, IndentationTypes } from '@asyncapi/generator-react-sdk';

export default function({ asyncapi, params }) {
  if (!params.generateHandlers) return null;
  return (
    <File name='Handlers.cs'>
      <CreateHandlerFile asyncApi={asyncapi} namespace={params.namespace} />
    </File>
  );
}

function CreateHandlerFile({asyncApi, namespace}) {
  const subscribeChannels = Object.entries(asyncApi.channels()).filter(array => array[1].hasSubscribe());
  const channelNames = subscribeChannels.map(x => x[0]);
  const channels = subscribeChannels.map(x => x[1]);
  const operationIds = channels.filter(x => x.hasSubscribe()).map(x => x.subscribe()['_json']['operationId']);
  const argumentNames = channels.filter(x => x.hasSubscribe()).map(x => x.subscribe().message().payload().title());
  const typePrefix = LongestPrefix(channelNames);
  const uniqueSources = channels
    .map(x => x.bindings().amqp.exchange.name)
    .filter((value, index, self) => self.indexOf(value) === index);
  if (uniqueSources.length > 1) console.log('Assumes all messages come from the same event source.');
  const source = uniqueSources[0];
  const className = 'Handlers';
  const methods = [];

  // eslint-disable-next-line security/detect-object-injection
  const channelEntries = channelNames.map((name, i) => [name, operationIds[i], argumentNames[i]]);

  for (const [name, operationId, argName] of channelEntries) {
    const trimmedName = name.replace(typePrefix, '').replace(/^\//, '');
    methods.push(
      <Indent size={4} type={IndentationTypes.SPACES}>
        <Text>[HandleIntegrationEvent({`"${trimmedName}"`}, 1)]</Text>
        <Text>public async Task {operationId}({argName} message)</Text>
        <Text>{'{'}</Text>
        <Indent size={4} type={IndentationTypes.SPACES}>
          <Text>{`// TODO: Handle ${argName} message`}</Text>
        </Indent>
        <Text>{'}'}</Text>
        <Text></Text>
      </Indent>);
  }

  return (
    <>
      <Text>using System;</Text>
      <Text>using Mktp.Messaging.Events;</Text>
      <Text></Text>
      <Text>namespace {namespace}</Text>
      <Text>{'{'}</Text>
      <Indent size={4} type={IndentationTypes.SPACES}>
        <Text>[IntegrationEventSource({`"/${source}"`})]</Text>
        <Text>[IntegrationEventTypePrefix({`"${typePrefix}"`})]</Text>
        <Text>public class {className}</Text>
        <Text>{'{'}</Text>
        {methods}
        <Text>{'}'}</Text>
      </Indent>
      <Text>{'}'}</Text>
    </>
  );
}

function LongestPrefix(array) {
  const sortedArray = array.concat().sort(), 
    first = sortedArray[0], 
    last = sortedArray[sortedArray.length-1], 
    firstLength = first.length;
  let i= 0;
  while (i<firstLength && first.charAt(i)=== last.charAt(i)) i++;
  const result = first.substring(0,i);
  return result.endsWith('/') ? result.slice(0, -1) : result;
}