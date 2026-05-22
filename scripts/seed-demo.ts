import { config } from 'dotenv'
config({ path: '.env.local' })
config() // fallback to .env if present
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const DEMO_PASSWORD = 'Demo@Quorum99!'

const DEMO_ACCOUNTS = [
  {
    email: 'editor@demo.quorum.dev',
    username: 'elena-vasquez',
    displayName: 'Elena Vasquez',
    bio: 'Ideas editor. Interested in long-form journalism and editorial process.',
    role: 'editor',
  },
  {
    email: 'writer1@demo.quorum.dev',
    username: 'james-okafor',
    displayName: 'James Okafor',
    bio: 'Urban affairs correspondent. Writes about cities, transport, and public space.',
    role: 'writer1',
  },
  {
    email: 'writer2@demo.quorum.dev',
    username: 'priya-nair',
    displayName: 'Priya Nair',
    bio: 'Climate and environment journalist. Focused on adaptation and resilience.',
    role: 'writer2',
  },
  {
    email: 'writer3@demo.quorum.dev',
    username: 'leo-brennan',
    displayName: 'Leo Brennan',
    bio: 'Political reporter covering marginalisation and structural inequality.',
    role: 'writer3',
  },
  {
    email: 'illustrator@demo.quorum.dev',
    username: 'sara-muller',
    displayName: 'Sara Müller',
    bio: 'Illustrator and visual journalist. Creates editorial imagery for print publications.',
    role: 'illustrator',
  },
  {
    email: 'latejoin@demo.quorum.dev',
    username: 'kwame-asante',
    displayName: 'Kwame Asante',
    bio: 'Economics writer covering precarity, labour markets, and financial exclusion.',
    role: 'latejoin',
  },
] as const

const AVATAR_COLORS = [
  '#2D6A4F',
  '#1B4F72',
  '#784212',
  '#512E5F',
  '#1A5276',
  '#7D6608',
]

function generateSvgAvatar(displayName: string, colorIndex: number): string {
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]
  const parts = displayName.split(' ')
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : displayName.slice(0, 2).toUpperCase()

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="32" fill="${color}"/>
  <text x="32" y="38" font-family="monospace" font-size="22" font-weight="bold" fill="#F5F2EC" text-anchor="middle">${initials}</text>
</svg>`

  const encoded = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${encoded}`
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Create/recreate demo accounts
  console.log('Creating demo accounts...')
  for (let i = 0; i < DEMO_ACCOUNTS.length; i++) {
    const acc = DEMO_ACCOUNTS[i]

    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find((u) => u.email === acc.email)

    let userId: string

    if (existingUser) {
      // Update password
      const { data: updated, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      })
      if (error) {
        console.error(`Failed to update user ${acc.email}:`, error.message)
        continue
      }
      userId = updated.user.id
      console.log(`  Updated: ${acc.email}`)
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
      })
      if (error) {
        console.error(`Failed to create user ${acc.email}:`, error.message)
        continue
      }
      userId = created.user.id
      console.log(`  Created: ${acc.email}`)
    }

    const avatarUrl = generateSvgAvatar(acc.displayName, i)

    // Upsert profile
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        username: acc.username,
        display_name: acc.displayName,
        bio: acc.bio,
        avatar_url: avatarUrl,
        merit_score: 95,
        merit_history: [],
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      console.error(`Failed to upsert profile for ${acc.email}:`, profileError.message)
    } else {
      console.log(`  Profile upserted: ${acc.username}`)
    }
  }

  // Generate articles using Anthropic
  console.log('\nGenerating articles via Anthropic API...')

  if (!anthropicApiKey) {
    console.warn('No ANTHROPIC_API_KEY found — inserting placeholder article content.')

    const placeholders = [
      {
        email: 'writer1@demo.quorum.dev',
        title: 'The Politics of the Bus Route',
        body: 'When the number 47 was rerouted three years ago, nobody held a press conference. There was a notice in the local paper — small print, buried under property listings — and then the change simply happened. For the 2,400 people who used that route daily, it meant an extra twenty minutes each way, a connecting bus that ran twice an hour, and, for those working early shifts at the distribution centre on Fenwick Road, a choice between arriving late or leaving home before dawn.\n\nThis is how transport policy works in most cities: not through grand announcements but through accumulated small decisions, each defensible in isolation, each shifting burden onto those who can least absorb it. The 47 was deemed underutilised. The data showed low ridership per kilometre. What the data did not show was who was riding it, or why, or what would happen to them when it was gone.\n\nUrban mobility researchers talk about "transit deserts" — areas where the density of public transport is insufficient to support car-free living. But the concept undersells the problem. Deserts are natural phenomena. Transit poverty is manufactured, decision by decision, reroute by reroute, over decades.\n\nI spent six months talking to the people most affected by the 47\'s disappearance. Maria, a hospital cleaner from Bratislava, who now cycles forty minutes each way in winter dark because the replacement service adds too much time to her shift. Winston, who drove taxis for twenty years before his licence was suspended and now cannot reach the job centre without a two-hour round trip. Amara, a student who stopped attending her evening classes entirely.\n\nWhat strikes you, talking to these people, is not their anger but their resignation. They have learned to work around the system because the system has never worked for them. Winston puts it plainly: "The bus was never for us. We just used it."\n\nThe language of transport planning is saturated with neutral-sounding metrics: catchment areas, interchanges, journey-time savings. These metrics tend to favour commuters travelling into city centres at peak times — who are disproportionately employed, housed, and white. The journeys that fall outside this model — the diagonal trip, the night shift, the outer-suburb link — appear in the data only as their absence.\n\nSome cities are beginning to map this gap deliberately. Helsinki has published "isochrone" maps showing how far different residents can travel in thirty minutes by public transport. The disparity is visible immediately: inner-city residents can reach vast swathes of the city; outer-suburb residents are effectively marooned. Making the inequality visible is not the same as fixing it, but it is a precondition for fixing it.\n\nThe 47 will not come back. The money saved has already been reallocated. But three boroughs over, a new "rapid transit corridor" is under construction, connecting the central business district to a regenerating waterfront. It will have dedicated lanes, real-time displays, and a name chosen by public vote. It will be described in council documents as "connecting communities." It will not stop anywhere near Fenwick Road.',
      },
      {
        email: 'writer2@demo.quorum.dev',
        title: 'Learning to Live With Water',
        body: "The sea wall at Happisburgh is four metres high, concrete, and visibly failing. Sections have been patched with rubble. One section, near the car park, has a crack running diagonally from top to bottom that wasn't there last winter. Local residents photograph it periodically, a form of community monitoring that no one asked them to do but everyone understands is necessary.\n\nHappisburgh is on the Norfolk coast, on what geologists call a soft-cliff coastline: glacial till, loose and friable, that erodes at two to three metres per year in normal conditions and considerably faster when storms come from the northeast. Since 2002, when the coastal defence funding was cut, twenty-six houses have been demolished or fallen into the sea. The village is smaller than it was. It is getting smaller.\n\nThis is what climate adaptation looks like at the sharp end — not solar panels and heat pumps, but orderly retreat and managed grief. The policy framework calls it \"managed realignment\": the sea is allowed to reclaim land, and people are relocated, theoretically with compensation. In practice, the compensation rarely reflects actual loss. House prices in erosion zones collapse before the erosion arrives, so owners sell at a loss if they can sell at all, and if they can't, they stay and watch.\n\nThe harder question — the one that climate policy is still struggling to ask clearly — is what we owe to people in the path of inevitable change. The standard answer is \"resilience\": communities must adapt, prepare, diversify. But resilience, as a policy framework, has a political convenience built into it. It locates responsibility for managing climate risk in the communities experiencing that risk, rather than in the systems that produced it.\n\nThere are better models. The Dutch have spent eighty years building a relationship with water that is neither surrender nor denial. Room for the River, their ambitious spatial planning programme, deliberately widens floodplains, relocates flood-prone buildings, and creates water storage areas that double as landscape parks. It is expensive, state-led, and predicated on a social contract that treats flood protection as a collective responsibility.\n\nBritain has no equivalent philosophy. Coastal policy is fragmented across local authorities with varying budgets and risk appetites. Some areas get sea walls; others get managed realignment strategies that are, in practice, policy euphemisms for abandonment.\n\nIn Happisburgh, there is a community archive project. Residents document the village as it was: buildings, families, routines. The archive is stored in multiple locations, in case any single one is lost. It is a form of memory-making in the face of physical erasure, and it is entirely unfunded.\n\nThe last house on Beach Road went over the cliff in January. The owner had already moved. She comes back sometimes and stands at the edge, looking at the gap where her kitchen used to be, and then she drives home.",
      },
      {
        email: 'writer3@demo.quorum.dev',
        title: 'The Invisible Constituency',
        body: "At the last general election, the turnout in the ten most deprived parliamentary constituencies averaged 51.4 per cent. In the ten least deprived, it was 72.1 per cent. This gap — call it the participation deficit — has been stable for twenty years, through different parties, different crises, different electoral systems. It is not a glitch. It is a feature.\n\nPolitical scientists have long understood that participation is correlated with resource. People who vote reliably are, in aggregate, more educated, more securely housed, more financially stable, and older than those who do not. They are also more likely to be white. These correlations do not reflect differential civic virtue; they reflect the fact that participation has costs — time, information, the belief that voting changes anything — and those costs are not evenly distributed.\n\nWhat is less discussed is how this participation gap shapes policy. Elected representatives are not indifferent to who votes for them. They hold surgeries, respond to letters, and pledge spending on the basis of where their voters are. If a constituency is reliably high-turnout and prosperous, it receives a different quality of political attention than one that is deprived and disengaged. This is not cynicism; it is incentive.\n\nThe result, over time, is a politics that is systematically skewed away from the most marginalised. Housing benefit freezes, the two-child benefit cap, the rollout of Universal Credit: each of these policies fell disproportionately on people with the lowest electoral leverage. None were electorally costly, because the people most affected were least likely to be in a polling booth.\n\nSome democracies have experimented with compulsory voting. Australia's system — where failure to vote incurs a small fine — produces turnout above 90 per cent and a measurably less skewed electorate. But compulsory voting is only part of the answer. Registration barriers, constituency boundaries, the first-past-the-post system: each of these compounds the participation deficit in different ways.\n\nThere is also the question of what people believe voting is for. In the communities with the lowest turnout, the most common reason given for not voting is not apathy but futility: a reasoned conclusion, based on experience, that the political system does not respond to people like them. This is not irrational. It is a measured assessment of the historical evidence.\n\nCorrecting for the participation deficit requires more than get-out-the-vote campaigns. It requires demonstrable policy responsiveness to non-voting populations — a kind of democratic commitment that runs against the current logic of political competition. It also requires taking seriously the possibility that representative democracy, as currently configured, does not represent everyone equally. That is not a comfortable conclusion for those who benefit from the current configuration. Which is, of course, precisely the problem.",
      },
      {
        email: 'latejoin@demo.quorum.dev',
        title: 'What Precarity Costs',
        body: "The IKEA bookcase in Dami's flat is held together with cable ties because she lost one of the cam locks in her last move and couldn't afford to replace the whole unit. She has moved four times in three years — twice because a landlord sold up, once because of a rent increase she couldn't absorb, once because of damp she couldn't get fixed. The bookcase has been dismantled and reassembled at each address, losing a little structural integrity each time.\n\nThis is a small thing. It is also not a small thing. Precarious housing produces precarious everything: precarious employment, because you can't take risks when your tenancy is uncertain; precarious relationships, because stress accumulates and overcrowded or unsuitable housing strains them; precarious health, because the cognitive load of financial instability is, in measurable physiological terms, exhausting.\n\nResearchers call this \"bandwidth poverty\" — the idea that financial precarity consumes cognitive resources that would otherwise be available for planning, self-regulation, and decision-making. A landmark 2013 study by Mullainathan and Shafir showed that the cognitive burden of financial stress is equivalent to losing thirteen IQ points. The implication is not that poor people make worse decisions; it is that scarcity makes good decision-making harder for anyone.\n\nThe economic literature on precarity focuses, understandably, on income. But income volatility — the unpredictability of earnings, not just their level — may be as damaging as income level. Gig economy workers earning reasonable average incomes report similar stress profiles to workers on lower but predictable wages. The inability to plan, to commit, to project forward, is itself a form of poverty.\n\nBritain's benefits system has compounded this problem in several ways. Universal Credit is paid monthly, in arrears, after a five-week wait for the first payment. For someone moving from fortnightly paid work, this is a structural cash-flow crisis built into the system's architecture. Food bank use surges in areas with high Universal Credit uptake not because people have less money in absolute terms, but because the timing mismatch is impossible to manage without reserves — and people in precarity have no reserves.\n\nDami works in social care. She earns £12.40 an hour on a zero-hours contract. Some weeks she works thirty-five hours; some weeks she works eighteen. She cannot get a mortgage — the irregular income makes her unattractive to lenders. She cannot save reliably — the variable income makes long-term planning impossible. She cannot afford to retrain — the unpredictable hours make evening courses difficult to commit to.\n\nShe is not unusual. There are approximately four million workers in the UK on zero-hours or low-hours variable contracts. The political language around this tends toward \"flexibility\" — a word that describes the employer's position, not the worker's experience. From where Dami sits, flexibility is another word for risk, transferred from capital to labour, and worn by individuals whose bookcase is held together with cable ties.",
      },
    ]

    for (const p of placeholders) {
      const { error } = await supabase.from('demo_content').upsert(
        {
          author_email: p.email,
          article_title: p.title,
          article_body: p.body,
        },
        { onConflict: 'author_email' }
      )
      if (error) {
        console.error(`Failed to insert demo content for ${p.email}:`, error.message)
      } else {
        console.log(`  Inserted placeholder article for ${p.email}`)
      }
    }

    // Insert placeholder for editor and illustrator
    const extras = [
      {
        email: 'editor@demo.quorum.dev',
        title: 'Editorial Introduction',
        body: 'This issue explores the hidden infrastructure of everyday life — the systems, policies, and structures that shape how we move, live, and participate in society. As editor, my brief to contributors was simple: start with the specific. A bus route. A sea wall. A ballot box. And then pull back to reveal the larger pattern. The result is four pieces that, together, make an argument about how inequality is built into the fabric of ordinary things.',
      },
      {
        email: 'illustrator@demo.quorum.dev',
        title: 'Cover Image Concept',
        body: 'Editorial illustration for Issue I: The Infrastructure of Everything. Concept: a cross-section view of a city block, rendered in a restricted palette of near-black, off-white, and a single red accent. The cross-section reveals hidden layers — pipes, cables, foundations — while the surface appears ordinary. No people visible; only the systems.',
      },
    ]

    for (const p of extras) {
      await supabase.from('demo_content').upsert(
        {
          author_email: p.email,
          article_title: p.title,
          article_body: p.body,
        },
        { onConflict: 'author_email' }
      )
    }
  } else {
    const anthropic = new Anthropic({ apiKey: anthropicApiKey })

    const prompt = `Generate 4 distinct long-form journalism articles for a high-quality independent magazine called "The Marginal Review". The issue theme is "The Infrastructure of Everything: the hidden systems that shape daily life."

Each article should be approximately 700 words, written in a serious, literary non-fiction style. No jargon. Specific, grounded in particular people and places. Each should open with a concrete scene or detail, not an abstract statement.

The four articles:
1. Urban infrastructure — about the politics of bus routes and who gets left out of public transport planning
2. Climate adaptation — about coastal communities facing managed retreat from rising seas
3. Political marginalisation — about the participation gap in democracy and who doesn't vote (and why that's rational)
4. Economic precarity — about zero-hours contracts, income volatility, and the real cost of financial instability

Return ONLY a valid JSON array with exactly 4 objects. Each object must have:
- "title": string (concise, editorial, not a question)
- "body": string (the full article text, ~700 words)

No markdown, no explanation, no code fences. Just the raw JSON array.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText =
      message.content[0].type === 'text' ? message.content[0].text : ''

    let articles: Array<{ title: string; body: string }>
    try {
      articles = JSON.parse(rawText)
    } catch {
      console.error('Failed to parse Anthropic response as JSON. Raw:', rawText.slice(0, 500))
      process.exit(1)
    }

    const writerEmails = [
      'writer1@demo.quorum.dev',
      'writer2@demo.quorum.dev',
      'writer3@demo.quorum.dev',
      'latejoin@demo.quorum.dev',
    ]

    for (let i = 0; i < writerEmails.length; i++) {
      const article = articles[i]
      if (!article) continue
      const { error } = await supabase.from('demo_content').upsert(
        {
          author_email: writerEmails[i],
          article_title: article.title,
          article_body: article.body,
        },
        { onConflict: 'author_email' }
      )
      if (error) {
        console.error(`Failed to insert article for ${writerEmails[i]}:`, error.message)
      } else {
        console.log(`  Inserted article for ${writerEmails[i]}: "${article.title}"`)
      }
    }

    // Insert placeholder for editor and illustrator
    const extras = [
      {
        email: 'editor@demo.quorum.dev',
        title: 'Editorial Introduction',
        body: 'This issue explores the hidden infrastructure of everyday life — the systems, policies, and structures that shape how we move, live, and participate in society. As editor, my brief to contributors was simple: start with the specific. A bus route. A sea wall. A ballot box. And then pull back to reveal the larger pattern.',
      },
      {
        email: 'illustrator@demo.quorum.dev',
        title: 'Cover Image Concept',
        body: 'Editorial illustration for Issue I: The Infrastructure of Everything. Concept: a cross-section view of a city block, rendered in a restricted palette of near-black, off-white, and a single red accent.',
      },
    ]

    for (const p of extras) {
      await supabase.from('demo_content').upsert(
        {
          author_email: p.email,
          article_title: p.title,
          article_body: p.body,
        },
        { onConflict: 'author_email' }
      )
    }
  }

  console.log('\n✓ Demo seeded. Run `npm run dev` and navigate to / to start.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
