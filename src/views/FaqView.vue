<script setup>
import PublicHeader from '../components/common/PublicHeader.vue'
import PublicFooter from '../components/common/PublicFooter.vue'

const faqItems = [
  {
    question: 'Can anyone play, or do I need to join a classroom?',
    answer:
      'Anyone can play. Independent play is the default and complete experience. Anyone can download the Android game, play through all scenarios, and track their personal progress without needing to join a classroom. Joining a classroom is completely optional for students whose instructor provides a 6-character code.',
  },
  {
    question: 'Can I play in a web browser?',
    answer:
      'No. The game runs natively on Android devices as an offline-first mobile app built in Godot. This web portal is used for account registration, viewing synchronized progress scores, and managing optional classrooms.',
  },
  {
    question: 'Do I need an internet connection to play?',
    answer:
      'Gameplay simulation missions run offline locally on your Android device. You do not need a continuous internet connection to play. An active connection is only required to initially sign in and sync completed mission scores to your web account.',
  },
  {
    question: 'Is the game available for iPhone or iPad?',
    answer:
      'CyberMorph is currently developed exclusively for Android. It is not currently available for iPhone or iPad (iOS).',
  },
  {
    question: 'Is it available on Google Play or Steam?',
    answer:
      'No. CyberMorph is not currently available on Google Play or Steam. During the beta period, players install the game directly using an Android APK package.',
  },
]
</script>

<template>
  <div class="faq-page">
    <PublicHeader />

    <main class="faq-main">
      <section class="faq-hero">
        <div class="page-container">
          <h1 class="page-title">Frequently asked questions</h1>
          <p class="page-lead">
            Clear answers regarding gameplay, offline availability, device support, and accounts.
          </p>
        </div>
      </section>

      <section class="faq-section">
        <div class="page-container">
          <div class="faq-list">
            <article
              v-for="(item, index) in faqItems"
              :key="index"
              class="faq-card"
            >
              <h2 class="faq-question">{{ item.question }}</h2>
              <p class="faq-answer">{{ item.answer }}</p>
            </article>
          </div>
        </div>
      </section>
    </main>

    <PublicFooter />
  </div>
</template>

<style scoped>
.faq-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
  color: var(--color-text-main);
}

.faq-main {
  flex: 1;
}

.page-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.faq-hero {
  padding: 3.5rem 0 2.5rem;
  background: linear-gradient(180deg, rgba(245, 243, 255, 0.6) 0%, rgba(255, 255, 255, 0) 100%);
  border-bottom: 1px solid var(--color-border);
}

.page-title {
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text-main);
  line-height: 1.15;
  margin-bottom: 1rem;
}

@media (min-width: 768px) {
  .page-title {
    font-size: 3rem;
  }
}

.page-lead {
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  max-width: 780px;
  margin: 0;
}

.faq-section {
  padding: 3.5rem 0 4.5rem;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.faq-card {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: var(--shadow-sm);
}

.faq-question {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-main);
  margin: 0 0 0.65rem 0;
}

.faq-answer {
  font-size: 0.925rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin: 0;
}
</style>
