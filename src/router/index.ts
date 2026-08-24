import { createRouter, createWebHistory } from 'vue-router'
import { authState, initializeGoogleAuth } from '@/services/googleAuth'

import LoginView from '@/views/LoginView.vue'
import HomeView from '@/views/HomeView.vue'
import AddBookView from '@/views/AddBookView.vue'
import EditBookView from '@/views/EditBookView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/add',
      name: 'add-book',
      component: AddBookView,
      meta: { requiresAuth: true },
    },
    {
      path: '/edit',
      name: 'edit-book',
      component: EditBookView,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  await initializeGoogleAuth()

  if (to.meta.requiresAuth && !authState.user) {
    return { name: 'login' }
  }

  if (to.name === 'login' && authState.user) {
    return { name: 'home' }
  }
})

export default router