import { Client, GatewayIntentBits, REST, TextChannel } from 'discord.js';
import { Routes } from 'discord-api-types/v9';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as config from './config.json';
import * as settings from './settings.json';
import * as fs from 'fs';

function updateSettingsFile(): void {
  fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2));
}

const { token, clientId, guildId } = config;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = [
  new SlashCommandBuilder()
    .setName('wordadd')
    .setDescription('Добавляет слово в список запрещенных.')
    .addStringOption(option => 
      option.setName('word')
        .setDescription('Слово или предложение для добавления.')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('worddel')
    .setDescription('Удаляет слово из списка запрещенных.')
    .addStringOption(option => 
      option.setName('word')
        .setDescription('Слово для удаления.')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('wordlist')
    .setDescription('Отображает список запрещенных слов.'),
  new SlashCommandBuilder()
    .setName('admadd')
    .setDescription('Добавляет пользователя в список разрешенных.')
    .addStringOption(option =>
      option.setName('iduser')
        .setDescription('ID пользователя для добавления.')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('admdel')
    .setDescription('Удаляет пользователя из списка разрешенных.')
    .addStringOption(option =>
      option.setName('iduser')
        .setDescription('ID пользователя для удаления.')
        .setRequired(true)
    ),
    new SlashCommandBuilder()
    .setName('boton')
    .setDescription('Включает модерацию в указанном канале.')
    .addStringOption(option =>
      option.setName('idchannel')
        .setDescription('ID канала для модерации.')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('botoff')
    .setDescription('Выключает модерацию в указанном канале.')
    .addStringOption(option =>
      option.setName('idchannel')
        .setDescription('ID канала для модерации.')
        .setRequired(true)
    ),
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    console.log('Загрузка бота....');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log('Почти готово....');
  } catch (error) {
    console.error(error);
  }
})();

client.on('messageCreate', async (message) => {
    if (!message.author.bot) {
    if (settings.moderated_channels.includes(message.channelId)) {
      if (checkForBannedWords(message.content)) {

        await message.delete();

        if (message.channel instanceof TextChannel) {
          const notificationText = `Сообщение от пользователя ${message.author.tag} было удалено из-за содержащегося банворда.`;

          const replyMessage = await message.channel.send(notificationText);
          setTimeout(() => {
            replyMessage.delete();
          }, 10000);
        } else {
          console.log('Не удалось отправить уведомление: канал не является текстовым каналом.');
        }
      }
    }
    }
  });
  
  function checkForBannedWords(content: string): boolean {
    const bannedWords = settings.banned_words.map(word => word.toLowerCase());
    const containsBannedWord = bannedWords.some(word => content.toLowerCase().includes(word));
    return containsBannedWord;
  }

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
  
    const { commandName, options, user } = interaction;
  
    if (!settings.allowed_user_ids.includes(user.id)) {
      await interaction.reply('Вы не имеете права использовать эту команду.');
      return;
    }
  
    if (commandName === 'wordadd') {
        const wordOption = options.get('word')?.value;
  
      if (!wordOption || typeof wordOption !== 'string' || wordOption.length > 25) {
        await interaction.reply('Пожалуйста, укажите слово или предложение до 25 символов.');
        return;
      }

      if (settings.banned_words.includes(wordOption.toLowerCase() as never)) {
        await interaction.reply(`Слово "${wordOption}" уже есть в списке запрещенных.`);
        return;
      }
  
      settings.banned_words.push(wordOption.toLowerCase() as never);
      updateSettingsFile();
      await interaction.reply(`Слово "${wordOption}" добавлено в список запрещенных.`);
    } else if (commandName === 'worddel') {
        const wordOption = options.get('word')?.value;
  
      if (!wordOption || typeof wordOption !== 'string') {
        await interaction.reply('Пожалуйста, укажите слово для удаления.');
        return;
      }

      const index = settings.banned_words.indexOf(wordOption.toLowerCase() as never);
      if (index === -1) {
        await interaction.reply(`Слово "${wordOption}" не найдено в списке запрещенных.`);
        return;
      }

      settings.banned_words.splice(index, 1);
      updateSettingsFile();
      await interaction.reply(`Слово "${wordOption}" удалено из списка запрещенных.`);
    } else if (commandName === 'wordlist') {
      const wordList = settings.banned_words.join(', ');
      if (wordList) {
        await interaction.reply(`Список запрещенных слов: ${wordList}`);
      } else {
        await interaction.reply('Список запрещенных слов пуст.');
      }

    } else if (commandName === 'admadd') {
        const userOption = options.get('iduser')?.value;
  
      if (!userOption || typeof userOption !== 'string' || userOption.length > 250) {
        await interaction.reply('Пожалуйста, укажите корректный айди.');
        return;
      }

      if (settings.allowed_user_ids.includes(userOption.toLowerCase() as never)) {
        await interaction.reply(`Пользователь "${userOption}" уже администратор.`);
        return;
      }
  
      settings.allowed_user_ids.push(userOption.toLowerCase() as never);
      updateSettingsFile();
      await interaction.reply(`Пользователь "${userOption}" добавлен к администрации.`);
    } else if (commandName === 'admdel') {
        const userOption = options.get('iduser')?.value;
  
      if (!userOption || typeof userOption !== 'string') {
        await interaction.reply('Пожалуйста, укажите айди пользователя для удаления.');
        return;
      }

      const index = settings.allowed_user_ids.indexOf(userOption.toLowerCase() as never);
      if (index === -1) {
        await interaction.reply(`Пользователь "${userOption}" не найден в списке администраторов.`);
        return;
      }

      settings.allowed_user_ids.splice(index, 1);
      updateSettingsFile();
      await interaction.reply(`Пользователь "${userOption}" больше не администратор.`);

    } 
    else if (commandName === 'boton') {
        const channelOption = options.get('idchannel')?.value;
  
      if (!channelOption || typeof channelOption !== 'string' || channelOption.length > 250) {
        await interaction.reply('Пожалуйста, укажите корректный айди.');
        return;
      }

      if (settings.moderated_channels.includes(channelOption.toLowerCase() as never)) {
        await interaction.reply(`Канал "${channelOption}" уже модерируется.`);
        return;
      }
  
      settings.moderated_channels.push(channelOption.toLowerCase() as never);
      updateSettingsFile();
      await interaction.reply(`На канале "${channelOption}" включена модерация.`);
    } else if (commandName === 'botoff') {
        const channelOption = options.get('idchannel')?.value;
  
      if (!channelOption || typeof channelOption !== 'string') {
        await interaction.reply('Пожалуйста, укажите айди канала для отключения модерации.');
        return;
      }

      const index = settings.moderated_channels.indexOf(channelOption.toLowerCase() as never);
      if (index === -1) {
        await interaction.reply(`Канал "${channelOption}" не найден в списке модерации.`);
        return;
      }

      settings.moderated_channels.splice(index, 1);
      updateSettingsFile();
      await interaction.reply(`На канале "${channelOption}" отключена модерация.`);
      }
    });

    client.once('ready', () => {
      console.log('Бот готов к работе!');
    });
    
    client.login(token);
