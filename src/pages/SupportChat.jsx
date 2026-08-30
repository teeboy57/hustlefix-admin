import React, { useEffect, useMemo, useState } from 'react'
import { ref, onValue, push, set, update } from 'firebase/database'
import { MessageSquareText, Search, SendHorizonal, UserRound } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const normalizeChatEntries = (data = {}) => {
  if (!data || typeof data !== 'object') return []

  return Object.entries(data)
    .map(([dbKey, value]) => {
      const chat = value && typeof value === 'object' ? value : {}
      const chatId = chat.chatId || chat.id || chat.key || dbKey
      const userId = chat.userId || chat.uid || chat.senderId || chat.user?.uid || dbKey
      const userName = chat.userName || chat.name || chat.user?.name || chat.email || chat.userEmail || userId

      return {
        dbKey,
        chatId,
        userId,
        userName,
        lastMessage: chat.lastMessage || chat.lastMessageText || chat.preview || '',
        updatedAt: Number(chat.updatedAt || chat.lastUpdated || chat.timestamp || 0),
        unreadCount: Number(chat.unreadCount || 0),
      }
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

const normalizeMessages = (data = {}) => {
  if (!data || typeof data !== 'object') return []

  const entries = Array.isArray(data)
    ? data
    : Object.entries(data)

  return entries
    .map(([key, value]) => {
      const message = value && typeof value === 'object' ? value : {}
      const messageId = message.messageId || message.id || key
      const senderId = message.senderId || message.userId || message.sender || ''
      const senderName = message.senderName || message.userName || message.name || (senderId === 'admin' ? 'Support Admin' : senderId)
      const messageText = message.messageText || message.text || message.message || ''
      const timestamp = Number(message.timestamp || message.createdAt || 0)

      return {
        messageId,
        senderId,
        senderName,
        messageText,
        timestamp,
      }
    })
    .filter((message) => message.messageId && message.messageText)
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
}

const formatTimestamp = (value) => {
  const time = Number(value)
  if (!time) return 'Just now'

  return new Date(time).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SupportChat() {
  const [chatList, setChatList] = useState([])
  const [selectedChatId, setSelectedChatId] = useState(null)
  const [messages, setMessages] = useState([])
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const chatsRef = ref(db, 'user_chats/admin_support')
    const unsubscribe = onValue(chatsRef, (snapshot) => {
      const data = snapshot.val() || {}
      const chats = normalizeChatEntries(data)
      setChatList(chats)
      setSelectedChatId((current) => {
        if (current && chats.some((chat) => chat.chatId === current)) return current
        return chats[0]?.chatId || null
      })
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([])
      return
    }

    const messagesRef = ref(db, `messages/${selectedChatId}`)
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {}
      setMessages(normalizeMessages(data))
    })

    return () => unsubscribe()
  }, [selectedChatId])

  const selectedChat = useMemo(
    () => chatList.find((chat) => chat.chatId === selectedChatId) || null,
    [chatList, selectedChatId],
  )

  const filteredChats = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return chatList

    return chatList.filter((chat) => {
      const haystack = `${chat.userName} ${chat.userId} ${chat.chatId} ${chat.lastMessage}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [chatList, search])

  const handleSendReply = async () => {
    if (!selectedChatId || !draft.trim()) return

    const messageText = draft.trim()
    const replyMessage = {
      messageId: `admin_${Date.now()}`,
      senderId: 'admin',
      senderName: 'Support Admin',
      messageText,
      timestamp: Date.now(),
    }

    setSending(true)
    try {
      const messagesRef = ref(db, `messages/${selectedChatId}`)
      const newMessageRef = push(messagesRef)
      await set(newMessageRef, replyMessage)

      const metadataRef = ref(db, `user_chats/admin_support/${selectedChat?.dbKey || selectedChatId}`)
      await update(metadataRef, {
        lastMessage: messageText,
        updatedAt: Date.now(),
        lastSender: 'Support Admin',
        chatId: selectedChatId,
      })

      setDraft('')
    } catch (error) {
      console.error('Failed to send support reply:', error)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MessageSquareText size={15} className="text-primary" /> Support Chat
          </p>
          <p className="text-xs text-muted-foreground">Messages sent from users to the admin support inbox</p>
        </div>
      </div>

      <div className="grid min-h-[640px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search chats"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="max-h-[620px] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading support chats…</div>
              ) : filteredChats.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No support chats yet.</div>
              ) : (
                filteredChats.map((chat) => (
                  <button
                    key={chat.dbKey || chat.chatId}
                    type="button"
                    onClick={() => setSelectedChatId(chat.chatId)}
                    className={`flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors ${
                      selectedChatId === chat.chatId ? 'bg-primary/5' : 'hover:bg-secondary/40'
                    }`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                      <UserRound size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{chat.userName}</p>
                        {chat.unreadCount > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px]">
                            {chat.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{chat.lastMessage || 'No messages yet'}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {chat.updatedAt ? formatTimestamp(chat.updatedAt) : 'New chat'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[640px]">
          <CardContent className="flex h-full flex-col p-0">
            {selectedChat ? (
              <>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedChat.userName}</p>
                    <p className="text-xs text-muted-foreground">{selectedChat.userId}</p>
                  </div>
                  <Badge variant="outline">Admin support</Badge>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-secondary/20 p-4">
                  {messages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
                      No messages in this support chat yet.
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isAdmin = message.senderId === 'admin' || message.senderName === 'Support Admin'

                      return (
                        <div
                          key={message.messageId}
                          className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${
                              isAdmin
                                ? 'bg-primary text-primary-foreground'
                                : 'border border-border bg-background text-foreground'
                            }`}
                          >
                            <p className="text-[11px] font-medium opacity-80">
                              {message.senderName}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm">{message.messageText}</p>
                            <p className={`mt-1 text-[10px] ${isAdmin ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                              {formatTimestamp(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="border-t border-border p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={3}
                      className="min-h-[80px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Type your reply to the user..."
                    />
                    <Button
                      onClick={handleSendReply}
                      disabled={sending || !draft.trim()}
                      className="h-[80px] min-w-[110px]"
                    >
                      <SendHorizonal size={15} className="mr-2" />
                      {sending ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                Select a support chat to view the conversation.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
