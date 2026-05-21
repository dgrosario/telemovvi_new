const amqp = require('amqplib');

async function sendReaction() {
  const connection = await amqp.connect('amqp://omnichannel:omnichannel@localhost:5672');
  const channel = await connection.createChannel();

  const requestQueue = 'gateway.requests';
  await channel.assertQueue(requestQueue, { durable: true });

  const correlationId = crypto.randomUUID();

  const request = {
    action: 'message.reaction',
    correlationId,
    replyTo: '',
    workspaceId: 'a090425b-f1a0-455f-a389-3d89f1a35829',
    channelId: 'cfd2de32-938b-48fc-83f7-04fcb2761a58',
    payload: {
      messageId: '3EB0E793A4E09662AF160D',
      remoteJid: '5561998202165@s.whatsapp.net',
      emoji: '👍',
      fromMe: true
    }
  };

  console.log('Sending reaction request:', JSON.stringify(request, null, 2));

  channel.sendToQueue(
    requestQueue,
    Buffer.from(JSON.stringify(request)),
    {
      persistent: true,
      contentType: 'application/json',
      correlationId
    }
  );

  console.log('Reaction request sent! CorrelationId:', correlationId);

  await new Promise(resolve => setTimeout(resolve, 1000));

  await channel.close();
  await connection.close();

  console.log('Done!');
}

sendReaction().catch(console.error);
